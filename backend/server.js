const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();

const DEFAULT_UPI_ID = process.env.UPI_ID || 'turfarena@upi';
const DEFAULT_UPI_NAME = process.env.UPI_NAME || 'TurfArena';
const DEFAULT_UPI_NOTE_PREFIX = process.env.UPI_NOTE_PREFIX || 'TurfArena';
const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 5001);
const ADMIN_EMAIL = normalizeEmail(process.env.ADMIN_EMAIL || 'admin@turfarena.com');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const FRONTEND_ROOT = path.join(__dirname, '..');

const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'turfarena_sql',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

let isDbConnected = false;

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use('/images', express.static(FRONTEND_ROOT, {
    index: false,
    fallthrough: true
}));
app.use(express.static(FRONTEND_ROOT, {
    index: 'index.html',
    fallthrough: true
}));

function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
}

function parseAmount(value, fallback = 0) {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) && numericValue >= 0 ? numericValue : fallback;
}

function toNullableDate(value) {
    const trimmed = String(value || '').trim();
    return trimmed || null;
}

function toNullableTime(value) {
    const trimmed = String(value || '').trim();
    return trimmed || null;
}

function normalizeSlots(slots) {
    if (!Array.isArray(slots)) return [];
    return [...new Set(
        slots
            .map(slot => parseInt(slot, 10))
            .filter(Number.isInteger)
            .filter(slot => slot >= 0 && slot <= 23)
    )].sort((a, b) => a - b);
}

function sanitizeUser(userRow) {
    return {
        _id: String(userRow.user_id),
        name: userRow.name,
        email: userRow.email,
        phone: userRow.phone,
        role: userRow.role,
        createdAt: userRow.created_at,
        updatedAt: userRow.updated_at
    };
}

function buildUpiIntent({ amount, purpose, reference }) {
    const params = new URLSearchParams({
        pa: DEFAULT_UPI_ID,
        pn: DEFAULT_UPI_NAME,
        am: Number(amount).toFixed(2),
        cu: 'INR',
        tn: `${DEFAULT_UPI_NOTE_PREFIX} ${purpose}`.trim(),
        tr: reference
    });

    return {
        method: 'UPI',
        merchantUpiId: DEFAULT_UPI_ID,
        merchantName: DEFAULT_UPI_NAME,
        amount: Number(amount).toFixed(2),
        reference,
        note: `${DEFAULT_UPI_NOTE_PREFIX} ${purpose}`.trim(),
        upiUrl: `upi://pay?${params.toString()}`
    };
}

function getBookingStartDateTime(booking) {
    const bookingDate = String(booking?.date || '').slice(0, 10);
    const numericSlots = (booking?.slots || [])
        .map(slot => parseInt(slot, 10))
        .filter(Number.isInteger)
        .sort((a, b) => a - b);

    if (!bookingDate || !numericSlots.length) return null;

    const [year, month, day] = bookingDate.split('-').map(Number);
    const hour = numericSlots[0];
    if (!year || !month || !day || !Number.isInteger(hour)) return null;

    return new Date(year, month - 1, day, hour, 0, 0, 0);
}

function getRefundDecision(booking, turf) {
    const startAt = getBookingStartDateTime(booking);
    const now = new Date();
    const isEligible = !!startAt && (startAt.getTime() - now.getTime()) >= (30 * 60 * 1000);
    const slotCount = Array.isArray(booking?.slots) ? booking.slots.length : 0;
    const pricePerSlot = Number(turf?.basePrice || 0);
    const refundAmount = isEligible ? slotCount * pricePerSlot : 0;

    return {
        isEligible,
        refundAmount
    };
}

function normalizeCommunityPayload(body = {}) {
    return {
        postType: String(body.postType || '').trim(),
        sport: String(body.sport || 'Football').trim(),
        teamName: String(body.teamName || '').trim(),
        turf: String(body.turf || '').trim(),
        spots: Math.max(0, parseInt(body.spots, 10) || 0),
        fare: parseAmount(body.fare),
        prizePool: String(body.prizePool || '').trim(),
        eventDate: body.eventDate ? String(body.eventDate).trim() : '',
        eventTime: body.eventTime ? String(body.eventTime).trim() : '',
        maxTeams: Math.max(0, parseInt(body.maxTeams, 10) || 0),
        status: String(body.status || 'Open').trim(),
        createdBy: normalizeEmail(body.createdBy),
        requests: Array.isArray(body.requests) ? body.requests : []
    };
}

function mapTurfRow(row, relations = {}) {
    return {
        _id: String(row.turf_id),
        name: row.name,
        meta: row.meta,
        location: row.location,
        basePrice: Number(row.base_price || 0),
        sports: relations.sports || [],
        panoramaUrl: row.panorama_url || '',
        image: row.image || '',
        reviews: relations.reviews || [],
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

function mapBookingRow(row, slots = [], turf = null) {
    return {
        _id: String(row.booking_id),
        turfId: turf,
        userName: row.user_name,
        userEmail: row.user_email,
        slots: slots.map(String),
        date: row.booking_date,
        status: row.status,
        paymentMethod: row.payment_method,
        paymentStatus: row.payment_status,
        upiTransactionId: row.upi_transaction_id,
        refundStatus: row.refund_status,
        refundAmount: Number(row.refund_amount || 0),
        cancelledAt: row.cancelled_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

function mapRequestRow(row) {
    return {
        _id: String(row.request_id),
        name: row.name,
        teamName: row.team_name || '',
        phone: row.phone || '',
        email: row.email,
        message: row.message || '',
        status: row.status,
        paymentMethod: row.payment_method,
        paymentStatus: row.payment_status,
        paymentAmount: Number(row.payment_amount || 0),
        upiTransactionId: row.upi_transaction_id || '',
        registeredAt: row.registered_at
    };
}

function mapCommunityReviewRow(row) {
    return {
        _id: String(row.review_id),
        userName: row.user_name,
        userEmail: row.user_email,
        rating: Number(row.rating || 0),
        comment: row.comment || '',
        createdAt: row.created_at
    };
}

function mapCommunityPostRow(row, relations = {}) {
    return {
        _id: String(row.post_id),
        postType: row.post_type,
        sport: row.sport,
        teamName: row.team_name,
        turf: row.turf || '',
        spots: Number(row.spots || 0),
        fare: Number(row.fare || 0),
        prizePool: row.prize_pool || '',
        eventDate: row.event_date,
        eventTime: row.event_time,
        maxTeams: Number(row.max_teams || 0),
        status: row.status,
        createdBy: row.created_by,
        requests: relations.requests || [],
        reviews: relations.reviews || [],
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

async function checkDatabaseConnection() {
    const connection = await pool.getConnection();
    try {
        await connection.query('SELECT 1');
        isDbConnected = true;
    } finally {
        connection.release();
    }
}

async function ensureDefaultAdmin() {
    const [existingRows] = await pool.query('SELECT user_id FROM users WHERE email = ? LIMIT 1', [ADMIN_EMAIL]);
    if (existingRows.length > 0) return;

    await pool.query(
        `INSERT INTO users (name, email, password, phone, role)
         VALUES (?, ?, ?, ?, 'admin')`,
        ['TurfArena Admin', ADMIN_EMAIL, ADMIN_PASSWORD, '0000000000']
    );
}

async function ensureDefaultTurfs() {
    const [countRows] = await pool.query('SELECT COUNT(*) AS count FROM turfs');
    if (Number(countRows[0]?.count || 0) > 0) return;

    const defaultTurfs = [
        {
            name: 'GreenLine Arena',
            meta: 'Velachery • Football, Cricket',
            location: 'Velachery',
            basePrice: 1200,
            sports: ['Football', 'Cricket'],
            panoramaUrl: 'https://pannellum.org/images/alma.jpg',
            image: 'aerial-view-grass-field-hockey.jpg'
        },
        {
            name: 'Boundary Line Turf',
            meta: 'Tambaram • Cricket box',
            location: 'Tambaram',
            basePrice: 800,
            sports: ['Cricket'],
            panoramaUrl: '',
            image: 'izuddin-helmi-adnan-K5ChxJaheKI-unsplash.jpg'
        },
        {
            name: 'SkyLine Sports Hub',
            meta: 'OMR • Multi-sport',
            location: 'OMR',
            basePrice: 1000,
            sports: ['Football', 'Cricket'],
            panoramaUrl: '',
            image: 'thomas-park-fDmpxdV69eA-unsplash.jpg'
        }
    ];

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        for (const turf of defaultTurfs) {
            const [result] = await connection.query(
                `INSERT INTO turfs (name, meta, location, base_price, panorama_url, image)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [turf.name, turf.meta, turf.location, turf.basePrice, turf.panoramaUrl, turf.image]
            );

            for (const sport of turf.sports) {
                await connection.query(
                    'INSERT INTO turf_sports (turf_id, sport_name) VALUES (?, ?)',
                    [result.insertId, sport]
                );
            }
        }

        await connection.commit();
    } catch (err) {
        await connection.rollback();
        throw err;
    } finally {
        connection.release();
    }
}

async function getTurfsByIds(turfIds) {
    if (!turfIds.length) return {};

    const placeholders = turfIds.map(() => '?').join(', ');
    const [turfRows] = await pool.query(
        `SELECT * FROM turfs WHERE turf_id IN (${placeholders})`,
        turfIds
    );
    const [sportRows] = await pool.query(
        `SELECT turf_id, sport_name FROM turf_sports WHERE turf_id IN (${placeholders}) ORDER BY turf_sport_id ASC`,
        turfIds
    );
    const [reviewRows] = await pool.query(
        `SELECT * FROM turf_reviews WHERE turf_id IN (${placeholders}) ORDER BY created_at DESC`,
        turfIds
    );

    const sportsByTurfId = {};
    sportRows.forEach(row => {
        const key = String(row.turf_id);
        sportsByTurfId[key] = sportsByTurfId[key] || [];
        sportsByTurfId[key].push(row.sport_name);
    });

    const reviewsByTurfId = {};
    reviewRows.forEach(row => {
        const key = String(row.turf_id);
        reviewsByTurfId[key] = reviewsByTurfId[key] || [];
        reviewsByTurfId[key].push({
            _id: String(row.turf_review_id),
            userName: row.user_name,
            userEmail: row.user_email,
            rating: Number(row.rating || 0),
            comment: row.comment || '',
            createdAt: row.created_at
        });
    });

    return turfRows.reduce((acc, row) => {
        acc[String(row.turf_id)] = mapTurfRow(row, {
            sports: sportsByTurfId[String(row.turf_id)] || [],
            reviews: reviewsByTurfId[String(row.turf_id)] || []
        });
        return acc;
    }, {});
}

async function getAllTurfs() {
    const [rows] = await pool.query('SELECT * FROM turfs ORDER BY created_at DESC');
    if (!rows.length) return [];

    const turfMap = await getTurfsByIds(rows.map(row => row.turf_id));
    return rows.map(row => turfMap[String(row.turf_id)]);
}

async function getTurfById(turfId) {
    const turfMap = await getTurfsByIds([Number(turfId)]);
    return turfMap[String(turfId)] || null;
}

async function getAllBookings() {
    const [bookingRows] = await pool.query('SELECT * FROM bookings ORDER BY created_at DESC');
    if (!bookingRows.length) return [];

    const bookingIds = bookingRows.map(row => row.booking_id);
    const turfIds = [...new Set(bookingRows.map(row => row.turf_id))];
    const placeholders = bookingIds.map(() => '?').join(', ');
    const [slotRows] = await pool.query(
        `SELECT booking_id, slot_hour FROM booking_slots WHERE booking_id IN (${placeholders}) ORDER BY slot_hour ASC`,
        bookingIds
    );

    const slotsByBookingId = {};
    slotRows.forEach(row => {
        const key = String(row.booking_id);
        slotsByBookingId[key] = slotsByBookingId[key] || [];
        slotsByBookingId[key].push(row.slot_hour);
    });

    const turfMap = await getTurfsByIds(turfIds);
    return bookingRows.map(row => mapBookingRow(
        row,
        slotsByBookingId[String(row.booking_id)] || [],
        turfMap[String(row.turf_id)] || null
    ));
}

async function getBookingById(bookingId) {
    const [bookingRows] = await pool.query('SELECT * FROM bookings WHERE booking_id = ? LIMIT 1', [bookingId]);
    if (!bookingRows.length) return null;

    const row = bookingRows[0];
    const [slotRows] = await pool.query(
        'SELECT slot_hour FROM booking_slots WHERE booking_id = ? ORDER BY slot_hour ASC',
        [bookingId]
    );
    const turf = await getTurfById(row.turf_id);
    return mapBookingRow(row, slotRows.map(slot => slot.slot_hour), turf);
}

async function getAllCommunityPosts() {
    const [postRows] = await pool.query('SELECT * FROM community_posts ORDER BY created_at DESC');
    if (!postRows.length) return [];

    const postIds = postRows.map(row => row.post_id);
    const placeholders = postIds.map(() => '?').join(', ');
    const [requestRows] = await pool.query(
        `SELECT * FROM community_requests WHERE post_id IN (${placeholders}) ORDER BY registered_at ASC`,
        postIds
    );
    const [reviewRows] = await pool.query(
        `SELECT * FROM community_reviews WHERE post_id IN (${placeholders}) ORDER BY created_at DESC`,
        postIds
    );

    const requestsByPostId = {};
    requestRows.forEach(row => {
        const key = String(row.post_id);
        requestsByPostId[key] = requestsByPostId[key] || [];
        requestsByPostId[key].push(mapRequestRow(row));
    });

    const reviewsByPostId = {};
    reviewRows.forEach(row => {
        const key = String(row.post_id);
        reviewsByPostId[key] = reviewsByPostId[key] || [];
        reviewsByPostId[key].push(mapCommunityReviewRow(row));
    });

    return postRows.map(row => mapCommunityPostRow(row, {
        requests: requestsByPostId[String(row.post_id)] || [],
        reviews: reviewsByPostId[String(row.post_id)] || []
    }));
}

async function getCommunityPostById(postId) {
    const [postRows] = await pool.query('SELECT * FROM community_posts WHERE post_id = ? LIMIT 1', [postId]);
    if (!postRows.length) return null;

    const [requestRows] = await pool.query(
        'SELECT * FROM community_requests WHERE post_id = ? ORDER BY registered_at ASC',
        [postId]
    );
    const [reviewRows] = await pool.query(
        'SELECT * FROM community_reviews WHERE post_id = ? ORDER BY created_at DESC',
        [postId]
    );

    return mapCommunityPostRow(postRows[0], {
        requests: requestRows.map(mapRequestRow),
        reviews: reviewRows.map(mapCommunityReviewRow)
    });
}

app.get('/api/health', async (req, res) => {
    try {
        await checkDatabaseConnection();
        res.status(200).json({
            ok: true,
            service: 'turfarena-backend',
            db: 'connected'
        });
    } catch (err) {
        isDbConnected = false;
        res.status(503).json({
            ok: false,
            service: 'turfarena-backend',
            db: 'disconnected'
        });
    }
});

app.get('/api/payments/config', (req, res) => {
    res.json({
        method: 'UPI',
        merchantUpiId: DEFAULT_UPI_ID,
        merchantName: DEFAULT_UPI_NAME,
        notePrefix: DEFAULT_UPI_NOTE_PREFIX,
        verification: 'client_confirmed'
    });
});

app.post('/api/payments/intent', (req, res) => {
    const amount = parseAmount(req.body.amount);
    const purpose = String(req.body.purpose || '').trim();
    const reference = String(req.body.reference || `TA-${Date.now()}`).trim();

    if (!amount || !purpose) {
        return res.status(400).json({ error: 'amount and purpose are required.' });
    }

    res.json(buildUpiIntent({ amount, purpose, reference }));
});

app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, phone, email, password } = req.body;
        if (!name || !phone || !email || !password) {
            return res.status(400).json({ error: 'name, phone, email, and password are required.' });
        }

        const normalizedEmail = normalizeEmail(email);
        const [existingRows] = await pool.query('SELECT user_id FROM users WHERE email = ? LIMIT 1', [normalizedEmail]);
        if (existingRows.length > 0) {
            return res.status(409).json({ error: 'Email already registered.' });
        }

        const [result] = await pool.query(
            `INSERT INTO users (name, phone, email, password, role)
             VALUES (?, ?, ?, ?, 'user')`,
            [String(name).trim(), String(phone).trim(), normalizedEmail, String(password)]
        );

        const [createdRows] = await pool.query('SELECT * FROM users WHERE user_id = ? LIMIT 1', [result.insertId]);
        res.status(201).json({ user: sanitizeUser(createdRows[0]) });
    } catch (err) {
        isDbConnected = false;
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'email and password are required.' });
        }

        const normalizedEmail = normalizeEmail(email);
        const [rows] = await pool.query('SELECT * FROM users WHERE email = ? LIMIT 1', [normalizedEmail]);
        const user = rows[0];
        if (!user || user.password !== String(password)) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        res.json({ user: sanitizeUser(user) });
    } catch (err) {
        isDbConnected = false;
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/users', async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT user_id, name, email, phone, role, created_at, updated_at FROM users ORDER BY created_at DESC'
        );
        res.json(rows.map(sanitizeUser));
    } catch (err) {
        isDbConnected = false;
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/turfs', async (req, res) => {
    try {
        const turfs = await getAllTurfs();
        res.json(turfs);
    } catch (err) {
        isDbConnected = false;
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/turfs', async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const payload = req.body || {};
        const name = String(payload.name || '').trim();
        if (!name) {
            return res.status(400).json({ error: 'name is required.' });
        }

        await connection.beginTransaction();
        const [result] = await connection.query(
            `INSERT INTO turfs (name, meta, location, base_price, panorama_url, image)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                name,
                String(payload.meta || '').trim(),
                String(payload.location || '').trim(),
                parseAmount(payload.basePrice),
                String(payload.panoramaUrl || '').trim(),
                String(payload.image || '').trim()
            ]
        );

        const sports = Array.isArray(payload.sports) ? payload.sports : [];
        for (const sport of sports.map(item => String(item || '').trim()).filter(Boolean)) {
            await connection.query(
                'INSERT INTO turf_sports (turf_id, sport_name) VALUES (?, ?)',
                [result.insertId, sport]
            );
        }

        await connection.commit();
        const turf = await getTurfById(result.insertId);
        res.status(201).json(turf);
    } catch (err) {
        await connection.rollback();
        isDbConnected = false;
        res.status(500).json({ error: err.message });
    } finally {
        connection.release();
    }
});

app.patch('/api/turfs/:id', async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const turfId = Number(req.params.id);
        const [existingRows] = await connection.query('SELECT turf_id FROM turfs WHERE turf_id = ? LIMIT 1', [turfId]);
        if (!existingRows.length) return res.status(404).json({ error: 'Turf not found' });

        const payload = req.body || {};
        await connection.beginTransaction();
        await connection.query(
            `UPDATE turfs
             SET name = ?, meta = ?, location = ?, base_price = ?, panorama_url = ?, image = ?
             WHERE turf_id = ?`,
            [
                String(payload.name || '').trim(),
                String(payload.meta || '').trim(),
                String(payload.location || '').trim(),
                parseAmount(payload.basePrice),
                String(payload.panoramaUrl || '').trim(),
                String(payload.image || '').trim(),
                turfId
            ]
        );

        if (Array.isArray(payload.sports)) {
            await connection.query('DELETE FROM turf_sports WHERE turf_id = ?', [turfId]);
            for (const sport of payload.sports.map(item => String(item || '').trim()).filter(Boolean)) {
                await connection.query('INSERT INTO turf_sports (turf_id, sport_name) VALUES (?, ?)', [turfId, sport]);
            }
        }

        await connection.commit();
        const updatedTurf = await getTurfById(turfId);
        res.json(updatedTurf);
    } catch (err) {
        await connection.rollback();
        isDbConnected = false;
        res.status(500).json({ error: err.message });
    } finally {
        connection.release();
    }
});

app.post('/api/turfs/:id/reviews', async (req, res) => {
    try {
        const turfId = Number(req.params.id);
        const turf = await getTurfById(turfId);
        if (!turf) return res.status(404).json({ error: 'Turf not found' });

        const userName = String(req.body.userName || '').trim();
        const userEmail = normalizeEmail(req.body.userEmail);
        const comment = String(req.body.comment || '').trim();
        const rating = Math.max(1, Math.min(5, parseInt(req.body.rating, 10) || 0));

        if (!userName || !userEmail || !rating) {
            return res.status(400).json({ error: 'userName, userEmail, and rating are required.' });
        }

        await pool.query(
            `INSERT INTO turf_reviews (turf_id, user_name, user_email, rating, comment)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                 user_name = VALUES(user_name),
                 rating = VALUES(rating),
                 comment = VALUES(comment),
                 updated_at = CURRENT_TIMESTAMP`,
            [turfId, userName, userEmail, rating, comment]
        );

        res.status(201).json(await getTurfById(turfId));
    } catch (err) {
        isDbConnected = false;
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/turfs/:id/reviews', async (req, res) => {
    try {
        const turfId = Number(req.params.id);
        const turf = await getTurfById(turfId);
        if (!turf) return res.status(404).json({ error: 'Turf not found' });

        const userEmail = normalizeEmail(req.body.userEmail || req.query.userEmail);
        if (!userEmail) {
            return res.status(400).json({ error: 'userEmail is required.' });
        }

        const [result] = await pool.query(
            'DELETE FROM turf_reviews WHERE turf_id = ? AND user_email = ?',
            [turfId, userEmail]
        );
        if (!result.affectedRows) {
            return res.status(404).json({ error: 'Review not found.' });
        }

        res.json(await getTurfById(turfId));
    } catch (err) {
        isDbConnected = false;
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/turfs/:id', async (req, res) => {
    try {
        const turfId = Number(req.params.id);
        const [result] = await pool.query('DELETE FROM turfs WHERE turf_id = ?', [turfId]);
        if (!result.affectedRows) return res.status(404).json({ error: 'Turf not found' });
        res.json({ success: true });
    } catch (err) {
        isDbConnected = false;
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/bookings', async (req, res) => {
    try {
        const bookings = await getAllBookings();
        res.json(bookings);
    } catch (err) {
        isDbConnected = false;
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/bookings', async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const turfId = Number(req.body.turfId);
        const slots = normalizeSlots(req.body.slots);
        const userName = String(req.body.userName || '').trim();
        const userEmail = normalizeEmail(req.body.userEmail);
        const bookingDate = String(req.body.date || '').slice(0, 10) || new Date().toISOString().split('T')[0];

        if (!turfId || !slots.length) {
            return res.status(400).json({ error: 'turfId and at least one slot are required.' });
        }

        await connection.beginTransaction();
        const [result] = await connection.query(
            `INSERT INTO bookings
             (turf_id, user_name, user_email, booking_date, status, payment_method, payment_status, upi_transaction_id, refund_status, refund_amount, cancelled_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                turfId,
                userName,
                userEmail,
                bookingDate,
                String(req.body.status || 'Confirmed'),
                String(req.body.paymentMethod || 'UPI'),
                String(req.body.paymentStatus || 'Pending'),
                String(req.body.upiTransactionId || '').trim() || null,
                String(req.body.refundStatus || 'Not Requested'),
                parseAmount(req.body.refundAmount),
                req.body.cancelledAt || null
            ]
        );

        for (const slot of slots) {
            await connection.query(
                'INSERT INTO booking_slots (booking_id, slot_hour) VALUES (?, ?)',
                [result.insertId, slot]
            );
        }

        await connection.commit();
        res.status(201).json(await getBookingById(result.insertId));
    } catch (err) {
        await connection.rollback();
        isDbConnected = false;
        res.status(500).json({ error: err.message });
    } finally {
        connection.release();
    }
});

app.patch('/api/bookings/:id', async (req, res) => {
    try {
        const bookingId = Number(req.params.id);
        const booking = await getBookingById(bookingId);
        if (!booking) return res.status(404).json({ error: 'Booking not found.' });

        if (req.body.status === 'Cancelled') {
            if (booking.status === 'Cancelled') {
                return res.status(400).json({ error: 'Booking already cancelled.' });
            }

            const refundDecision = getRefundDecision(booking, booking.turfId);
            await pool.query(
                `UPDATE bookings
                 SET status = 'Cancelled', cancelled_at = NOW(), refund_status = ?, refund_amount = ?, updated_at = CURRENT_TIMESTAMP
                 WHERE booking_id = ?`,
                [refundDecision.isEligible ? 'Refunded' : 'Not Eligible', refundDecision.refundAmount, bookingId]
            );
            return res.json(await getBookingById(bookingId));
        }

        await pool.query(
            'UPDATE bookings SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE booking_id = ?',
            [String(req.body.status || booking.status), bookingId]
        );
        res.json(await getBookingById(bookingId));
    } catch (err) {
        isDbConnected = false;
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/community', async (req, res) => {
    try {
        const posts = await getAllCommunityPosts();
        res.json(posts);
    } catch (err) {
        isDbConnected = false;
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/community', async (req, res) => {
    try {
        const payload = normalizeCommunityPayload(req.body);

        if (!['solo', 'team', 'tournament'].includes(payload.postType)) {
            return res.status(400).json({ error: 'postType must be solo, team, or tournament.' });
        }
        if (!payload.teamName || !payload.createdBy) {
            return res.status(400).json({ error: 'teamName and createdBy are required.' });
        }
        if (payload.postType === 'solo' && payload.spots <= 0) {
            return res.status(400).json({ error: 'Solo openings must have at least one open spot.' });
        }
        if (payload.postType === 'tournament') {
            if (payload.createdBy !== ADMIN_EMAIL) {
                return res.status(403).json({ error: 'Only admins can create tournaments.' });
            }
            if (!payload.eventDate) {
                return res.status(400).json({ error: 'Tournament date is required.' });
            }
            payload.maxTeams = payload.maxTeams || 16;
            payload.status = payload.status || 'Registrations Open';
        }

        const [result] = await pool.query(
            `INSERT INTO community_posts
             (post_type, sport, team_name, turf, spots, fare, prize_pool, event_date, event_time, max_teams, status, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                payload.postType,
                payload.sport,
                payload.teamName,
                payload.turf,
                payload.spots,
                payload.fare,
                payload.prizePool,
                toNullableDate(payload.eventDate),
                toNullableTime(payload.eventTime),
                payload.maxTeams,
                payload.status,
                payload.createdBy
            ]
        );

        res.status(201).json(await getCommunityPostById(result.insertId));
    } catch (err) {
        isDbConnected = false;
        res.status(500).json({ error: err.message });
    }
});

app.patch('/api/community/:id', async (req, res) => {
    try {
        const postId = Number(req.params.id);
        const post = await getCommunityPostById(postId);
        if (!post) return res.status(404).json({ error: 'Post not found' });

        const nextValues = {
            status: Object.prototype.hasOwnProperty.call(req.body, 'status') ? String(req.body.status || '').trim() : post.status,
            turf: Object.prototype.hasOwnProperty.call(req.body, 'turf') ? String(req.body.turf || '').trim() : post.turf,
            fare: Object.prototype.hasOwnProperty.call(req.body, 'fare') ? parseAmount(req.body.fare) : post.fare,
            prizePool: Object.prototype.hasOwnProperty.call(req.body, 'prizePool') ? String(req.body.prizePool || '').trim() : post.prizePool,
            eventDate: Object.prototype.hasOwnProperty.call(req.body, 'eventDate') ? toNullableDate(req.body.eventDate) : post.eventDate,
            eventTime: Object.prototype.hasOwnProperty.call(req.body, 'eventTime') ? toNullableTime(req.body.eventTime) : post.eventTime,
            maxTeams: Object.prototype.hasOwnProperty.call(req.body, 'maxTeams') ? Math.max(0, parseInt(req.body.maxTeams, 10) || 0) : post.maxTeams,
            spots: Object.prototype.hasOwnProperty.call(req.body, 'spots') ? Math.max(0, parseInt(req.body.spots, 10) || 0) : post.spots
        };

        if (post.postType === 'solo' && Object.prototype.hasOwnProperty.call(req.body, 'spots')) {
            nextValues.status = nextValues.spots > 0 ? 'Open' : 'Full';
        }

        await pool.query(
            `UPDATE community_posts
             SET status = ?, turf = ?, fare = ?, prize_pool = ?, event_date = ?, event_time = ?, max_teams = ?, spots = ?, updated_at = CURRENT_TIMESTAMP
             WHERE post_id = ?`,
            [
                nextValues.status,
                nextValues.turf,
                nextValues.fare,
                nextValues.prizePool,
                nextValues.eventDate,
                nextValues.eventTime,
                nextValues.maxTeams,
                nextValues.spots,
                postId
            ]
        );

        res.json(await getCommunityPostById(postId));
    } catch (err) {
        isDbConnected = false;
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/community/:id', async (req, res) => {
    try {
        const postId = Number(req.params.id);
        const [result] = await pool.query('DELETE FROM community_posts WHERE post_id = ?', [postId]);
        if (!result.affectedRows) return res.status(404).json({ error: 'Post not found' });
        res.json({ success: true, deletedPostId: req.params.id });
    } catch (err) {
        isDbConnected = false;
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/community/:id/request', async (req, res) => {
    try {
        const postId = Number(req.params.id);
        const post = await getCommunityPostById(postId);
        if (!post) return res.status(404).json({ error: 'Post not found' });

        const requesterEmail = normalizeEmail(req.body.email);
        const requesterName = String(req.body.name || '').trim();
        const requesterTeam = String(req.body.teamName || '').trim();
        const requesterPhone = String(req.body.phone || '').trim();
        let requesterStatus = ['Accepted', 'Rejected', 'Pending'].includes(req.body.status) ? req.body.status : 'Pending';
        const paymentStatus = req.body.paymentStatus === 'Paid' ? 'Paid' : (post.postType === 'tournament' ? 'Pending' : 'Not Required');
        const paymentAmount = parseAmount(req.body.paymentAmount || req.body.fare || post.fare || 0);
        const upiTransactionId = String(req.body.upiTransactionId || '').trim();

        if (!requesterEmail || !requesterName) {
            return res.status(400).json({ error: 'name and email are required for requests.' });
        }
        if (requesterEmail === post.createdBy) {
            return res.status(400).json({ error: 'You cannot respond to your own post.' });
        }
        if (post.postType === 'solo' && post.spots <= 0) {
            return res.status(400).json({ error: 'This team is already full.' });
        }
        if (post.postType === 'tournament') {
            if (!requesterTeam || !requesterPhone) {
                return res.status(400).json({ error: 'teamName and phone are required for tournament registration.' });
            }
            const acceptedTeams = post.requests.filter(entry => entry.status !== 'Rejected').length;
            if (post.maxTeams > 0 && acceptedTeams >= post.maxTeams) {
                return res.status(400).json({ error: 'Tournament registration is full.' });
            }
            if (!upiTransactionId) {
                return res.status(400).json({ error: 'UPI transaction ID is required for tournament registration.' });
            }
        }

        const duplicateRequest = post.requests.some(entry => normalizeEmail(entry.email) === requesterEmail);
        const duplicateTeamName = post.postType === 'tournament'
            ? post.requests.some(entry => String(entry.teamName || '').trim().toLowerCase() === requesterTeam.toLowerCase())
            : false;

        if (duplicateRequest || duplicateTeamName) {
            return res.status(409).json({ error: 'A request from this user or team already exists.' });
        }

        if (post.postType === 'team' || post.postType === 'tournament') {
            requesterStatus = 'Pending';
        }

        await pool.query(
            `INSERT INTO community_requests
             (post_id, name, team_name, phone, email, message, status, payment_method, payment_status, payment_amount, upi_transaction_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'UPI', ?, ?, ?)`,
            [
                postId,
                requesterName,
                requesterTeam || null,
                requesterPhone || null,
                requesterEmail,
                String(req.body.message || '').trim(),
                requesterStatus,
                paymentStatus,
                paymentAmount,
                upiTransactionId || null
            ]
        );

        if (post.postType === 'team') {
            await pool.query(
                "UPDATE community_posts SET status = 'Awaiting Admin Approval', updated_at = CURRENT_TIMESTAMP WHERE post_id = ?",
                [postId]
            );
        }
        if (post.postType === 'tournament' && post.maxTeams > 0 && (post.requests.length + 1) >= post.maxTeams) {
            await pool.query(
                "UPDATE community_posts SET status = 'Full', updated_at = CURRENT_TIMESTAMP WHERE post_id = ?",
                [postId]
            );
        }

        res.status(201).json(await getCommunityPostById(postId));
    } catch (err) {
        isDbConnected = false;
        res.status(500).json({ error: err.message });
    }
});

app.patch('/api/community/:postId/request/:requestId', async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const postId = Number(req.params.postId);
        const requestId = Number(req.params.requestId);
        const { status } = req.body;
        if (!['Accepted', 'Rejected', 'Pending'].includes(status)) {
            return res.status(400).json({ error: 'status must be Accepted, Rejected, or Pending.' });
        }

        const post = await getCommunityPostById(postId);
        if (!post) return res.status(404).json({ error: 'Post not found' });

        const requestEntry = post.requests.find(entry => Number(entry._id) === requestId);
        if (!requestEntry) return res.status(404).json({ error: 'Request not found' });

        const previousStatus = requestEntry.status;
        let nextPostStatus = post.status;
        let nextSpots = post.spots;

        if (post.postType === 'solo') {
            if (status === 'Accepted' && previousStatus !== 'Accepted') {
                if (post.spots <= 0) {
                    return res.status(400).json({ error: 'No spots remaining.' });
                }
                nextSpots -= 1;
            }
            if (previousStatus === 'Accepted' && status !== 'Accepted') {
                nextSpots += 1;
            }
            nextPostStatus = nextSpots <= 0 ? 'Full' : 'Open';
        }

        await connection.beginTransaction();
        if (post.postType === 'team' && status === 'Accepted') {
            await connection.query(
                `UPDATE community_requests
                 SET status = CASE WHEN request_id = ? THEN 'Accepted' ELSE 'Rejected' END
                 WHERE post_id = ? AND status IN ('Accepted', 'Pending', 'Rejected')`,
                [requestId, postId]
            );
            nextPostStatus = 'Matched';
        } else {
            await connection.query(
                'UPDATE community_requests SET status = ? WHERE request_id = ? AND post_id = ?',
                [status, requestId, postId]
            );

            if (post.postType === 'team') {
                nextPostStatus = previousStatus === 'Accepted' && status !== 'Accepted' ? 'Open' : post.status;
            }
        }

        if (post.postType === 'solo') {
            await connection.query(
                'UPDATE community_posts SET spots = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE post_id = ?',
                [nextSpots, nextPostStatus, postId]
            );
        } else if (post.postType === 'team') {
            await connection.query(
                'UPDATE community_posts SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE post_id = ?',
                [nextPostStatus, postId]
            );
        }

        await connection.commit();
        res.json(await getCommunityPostById(postId));
    } catch (err) {
        await connection.rollback();
        isDbConnected = false;
        res.status(500).json({ error: err.message });
    } finally {
        connection.release();
    }
});

app.delete('/api/community/:postId/request/:requestId', async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const postId = Number(req.params.postId);
        const requestId = Number(req.params.requestId);
        const post = await getCommunityPostById(postId);
        if (!post) return res.status(404).json({ error: 'Post not found' });

        const requestEntry = post.requests.find(entry => Number(entry._id) === requestId);
        if (!requestEntry) return res.status(404).json({ error: 'Request not found' });

        let nextSpots = post.spots;
        let nextStatus = post.status;

        if (post.postType === 'solo' && requestEntry.status === 'Accepted') {
            nextSpots += 1;
            if (nextSpots > 0 && post.status === 'Full') {
                nextStatus = 'Open';
            }
        }

        if (post.postType === 'team') {
            const acceptedRequest = post.requests.find(entry => entry._id !== requestEntry._id && entry.status === 'Accepted');
            nextStatus = acceptedRequest ? 'Matched' : 'Open';
        }

        if (post.postType === 'tournament' && post.maxTeams > 0) {
            const liveTeams = post.requests.filter(entry => entry._id !== requestEntry._id && entry.status !== 'Rejected').length;
            if (liveTeams < post.maxTeams && post.status === 'Full') {
                nextStatus = 'Registrations Open';
            }
        }

        await connection.beginTransaction();
        await connection.query('DELETE FROM community_requests WHERE request_id = ? AND post_id = ?', [requestId, postId]);

        if (post.postType === 'solo') {
            await connection.query(
                'UPDATE community_posts SET spots = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE post_id = ?',
                [nextSpots, nextStatus, postId]
            );
        } else if (post.postType === 'team' || post.postType === 'tournament') {
            await connection.query(
                'UPDATE community_posts SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE post_id = ?',
                [nextStatus, postId]
            );
        }

        await connection.commit();
        res.json(await getCommunityPostById(postId));
    } catch (err) {
        await connection.rollback();
        isDbConnected = false;
        res.status(500).json({ error: err.message });
    } finally {
        connection.release();
    }
});

app.post('/api/community/:id/reviews', async (req, res) => {
    try {
        const postId = Number(req.params.id);
        const post = await getCommunityPostById(postId);
        if (!post) return res.status(404).json({ error: 'Post not found' });

        const userName = String(req.body.userName || '').trim();
        const userEmail = normalizeEmail(req.body.userEmail);
        const comment = String(req.body.comment || '').trim();
        const rating = Math.max(1, Math.min(5, parseInt(req.body.rating, 10) || 0));

        if (!userName || !userEmail || !rating) {
            return res.status(400).json({ error: 'userName, userEmail, and rating are required.' });
        }

        await pool.query(
            `INSERT INTO community_reviews (post_id, user_name, user_email, rating, comment)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                 user_name = VALUES(user_name),
                 rating = VALUES(rating),
                 comment = VALUES(comment),
                 updated_at = CURRENT_TIMESTAMP`,
            [postId, userName, userEmail, rating, comment]
        );

        res.status(201).json(await getCommunityPostById(postId));
    } catch (err) {
        isDbConnected = false;
        res.status(500).json({ error: err.message });
    }
});

async function startServer() {
    try {
        await checkDatabaseConnection();
        await ensureDefaultAdmin();
        await ensureDefaultTurfs();
        console.log('SQL database connected and seeded.');
    } catch (err) {
        isDbConnected = false;
        console.error('Database connection error:', err.message);
    }

    app.listen(PORT, HOST, () => {
        console.log('\n================================');
        console.log('🚀 TurfArena Backend Live!');
        console.log(`📡 Host: ${HOST}`);
        console.log(`📡 Port: ${PORT}`);
        console.log('================================\n');
    });
}

startServer();
