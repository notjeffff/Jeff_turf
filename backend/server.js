require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const User = require('./models/User');

const app = express();
let isDbConnected = false;

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://admin:admin123@turfarenacluster.8ai5xzs.mongodb.net/turfarena?appName=TurfArenaCluster';
const DEFAULT_UPI_ID = process.env.UPI_ID || 'turfarena@upi';
const DEFAULT_UPI_NAME = process.env.UPI_NAME || 'TurfArena';
const DEFAULT_UPI_NOTE_PREFIX = process.env.UPI_NOTE_PREFIX || 'TurfArena';
const HOST = process.env.HOST || '127.0.0.1';

mongoose.connect(MONGO_URI)
  .then(async () => {
    isDbConnected = true;
    console.log('🔥 Connected to MongoDB (TurfArena DB)');
    await ensureDefaultAdmin();
    await ensureDefaultTurfs();
  })
  .catch(err => {
    isDbConnected = false;
    console.error('Database connection error:', err);
  });

mongoose.connection.on('connected', () => { isDbConnected = true; });
mongoose.connection.on('disconnected', () => { isDbConnected = false; });
mongoose.connection.on('error', () => { isDbConnected = false; });

const turfSchema = new mongoose.Schema({
    name: { type: String, required: true },
    meta: String,
    location: String,
    basePrice: Number,
    sports: [String],
    panoramaUrl: String,
    image: String
}, { timestamps: true });
const Turf = mongoose.model('Turf', turfSchema);

const bookingSchema = new mongoose.Schema({
    turfId: { type: mongoose.Schema.Types.ObjectId, ref: 'Turf', required: true },
    userName: String,
    userEmail: String,
    slots: [String],
    date: { type: String, default: () => new Date().toISOString().split('T')[0] },
    status: { type: String, default: 'Pending' },
    paymentMethod: { type: String, default: 'UPI' },
    paymentStatus: { type: String, enum: ['Pending', 'Paid'], default: 'Pending' },
    upiTransactionId: String
}, { timestamps: true });
const Booking = mongoose.model('Booking', bookingSchema);

const requestSchema = new mongoose.Schema({
    name: String,
    teamName: String,
    phone: String,
    email: String,
    message: String,
    status: { type: String, enum: ['Pending', 'Accepted', 'Rejected'], default: 'Pending' },
    paymentMethod: { type: String, default: 'UPI' },
    paymentStatus: { type: String, enum: ['Not Required', 'Pending', 'Paid'], default: 'Pending' },
    paymentAmount: { type: Number, default: 0 },
    upiTransactionId: String,
    registeredAt: { type: Date, default: Date.now }
}, { _id: true });

const communityPostSchema = new mongoose.Schema({
    postType: { type: String, enum: ['solo', 'team', 'tournament'], required: true },
    sport: { type: String, default: 'Football' },
    teamName: { type: String, required: true },
    turf: { type: String, default: '' },
    spots: { type: Number, default: 0 },
    fare: { type: Number, default: 0 },
    prizePool: { type: String, default: '' },
    eventDate: String,
    eventTime: String,
    maxTeams: { type: Number, default: 0 },
    status: { type: String, default: 'Open' },
    createdBy: { type: String, required: true },
    requests: [requestSchema]
}, { timestamps: true });
const CommunityPost = mongoose.model('CommunityPost', communityPostSchema);

async function ensureDefaultAdmin() {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@turfarena.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    const existingAdmin = await User.findOne({ email: adminEmail });
    if (!existingAdmin) {
        await User.create({
            name: 'TurfArena Admin',
            email: adminEmail,
            password: adminPassword,
            phone: '0000000000',
            role: 'admin'
        });
        console.log(`✅ Default admin created: ${adminEmail}`);
    }
}

async function ensureDefaultTurfs() {
    const existingTurfCount = await Turf.countDocuments();
    if (existingTurfCount > 0) return;

    const defaultTurfs = [
        {
            name: 'GreenLine Arena',
            meta: 'Velachery • Football, Cricket',
            location: 'Velachery',
            basePrice: 1200,
            sports: ['Football', 'Cricket'],
            panoramaUrl: 'https://pannellum.org/images/alma.jpg'
        },
        {
            name: 'Boundary Line Turf',
            meta: 'Tambaram • Cricket box',
            location: 'Tambaram',
            basePrice: 800,
            sports: ['Cricket'],
            panoramaUrl: ''
        },
        {
            name: 'SkyLine Sports Hub',
            meta: 'OMR • Multi-sport',
            location: 'OMR',
            basePrice: 1000,
            sports: ['Football', 'Cricket'],
            panoramaUrl: ''
        }
    ];

    await Turf.insertMany(defaultTurfs);
    console.log('✅ Default turfs seeded into MongoDB');
}

function sanitizeUser(userDoc) {
    return {
        _id: userDoc._id,
        name: userDoc.name,
        email: userDoc.email,
        phone: userDoc.phone,
        role: userDoc.role,
        createdAt: userDoc.createdAt,
        updatedAt: userDoc.updatedAt
    };
}

function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
}

function parseAmount(value, fallback = 0) {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) && numericValue >= 0 ? numericValue : fallback;
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

app.get('/api/health', (req, res) => {
    res.status(isDbConnected ? 200 : 503).json({
        ok: isDbConnected,
        service: 'turfarena-backend',
        db: isDbConnected ? 'connected' : 'disconnected'
    });
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
        const existingUser = await User.findOne({ email: normalizedEmail });
        if (existingUser) {
            return res.status(409).json({ error: 'Email already registered.' });
        }

        const newUser = await User.create({
            name: String(name).trim(),
            phone: String(phone).trim(),
            email: normalizedEmail,
            password: String(password),
            role: 'user'
        });

        res.status(201).json({ user: sanitizeUser(newUser) });
    } catch (err) {
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
        const user = await User.findOne({ email: normalizedEmail });
        if (!user || user.password !== String(password)) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        res.json({ user: sanitizeUser(user) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/users', async (req, res) => {
    try {
        if (!isDbConnected) return res.status(503).json({ error: 'Database unavailable. Check MongoDB connection.' });
        const users = await User.find({}, { password: 0 }).sort({ createdAt: -1 });
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/turfs', async (req, res) => {
    try {
        if (!isDbConnected) return res.status(503).json({ error: 'Database unavailable. Check MongoDB connection.' });
        const turfs = await Turf.find().sort({ createdAt: -1 });
        res.json(turfs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/turfs', async (req, res) => {
    try {
        if (!isDbConnected) return res.status(503).json({ error: 'Database unavailable. Check MongoDB connection.' });
        const newTurf = new Turf(req.body);
        const savedTurf = await newTurf.save();
        res.status(201).json(savedTurf);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.patch('/api/turfs/:id', async (req, res) => {
    try {
        if (!isDbConnected) return res.status(503).json({ error: 'Database unavailable. Check MongoDB connection.' });
        const updatedTurf = await Turf.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedTurf) return res.status(404).json({ error: 'Turf not found' });
        res.json(updatedTurf);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/turfs/:id', async (req, res) => {
    try {
        if (!isDbConnected) return res.status(503).json({ error: 'Database unavailable. Check MongoDB connection.' });
        const deletedTurf = await Turf.findByIdAndDelete(req.params.id);
        if (!deletedTurf) return res.status(404).json({ error: 'Turf not found' });
        await Booking.deleteMany({ turfId: req.params.id });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/bookings', async (req, res) => {
    try {
        if (!isDbConnected) return res.status(503).json({ error: 'Database unavailable. Check MongoDB connection.' });
        const bookings = await Booking.find().populate('turfId').sort({ createdAt: -1 });
        res.json(bookings);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/bookings', async (req, res) => {
    try {
        if (!isDbConnected) return res.status(503).json({ error: 'Database unavailable. Check MongoDB connection.' });
        if (!req.body.turfId || !Array.isArray(req.body.slots) || req.body.slots.length === 0) {
            return res.status(400).json({ error: 'turfId and at least one slot are required.' });
        }

        const newBooking = new Booking(req.body);
        const savedBooking = await newBooking.save();
        res.status(201).json(savedBooking);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.patch('/api/bookings/:id', async (req, res) => {
    try {
        if (!isDbConnected) return res.status(503).json({ error: 'Database unavailable. Check MongoDB connection.' });
        const updatedBooking = await Booking.findByIdAndUpdate(
            req.params.id,
            { status: req.body.status },
            { new: true }
        );
        res.json(updatedBooking);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/community', async (req, res) => {
    try {
        if (!isDbConnected) return res.status(503).json({ error: 'Database unavailable. Check MongoDB connection.' });
        const posts = await CommunityPost.find().sort({ createdAt: -1 });
        res.json(posts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/community', async (req, res) => {
    try {
        if (!isDbConnected) return res.status(503).json({ error: 'Database unavailable. Check MongoDB connection.' });
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
            payload.maxTeams = payload.maxTeams || 16;
            payload.status = payload.status || 'Registrations Open';
        }

        const savedPost = await CommunityPost.create(payload);
        res.status(201).json(savedPost);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.patch('/api/community/:id', async (req, res) => {
    try {
        if (!isDbConnected) return res.status(503).json({ error: 'Database unavailable. Check MongoDB connection.' });
        const allowedFields = ['status', 'turf', 'fare', 'prizePool', 'eventDate', 'eventTime', 'maxTeams'];
        const updates = {};

        allowedFields.forEach(field => {
            if (Object.prototype.hasOwnProperty.call(req.body, field)) {
                updates[field] = req.body[field];
            }
        });

        const updatedPost = await CommunityPost.findByIdAndUpdate(req.params.id, updates, { new: true });
        if (!updatedPost) return res.status(404).json({ error: 'Post not found' });
        res.json(updatedPost);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/community/:id/request', async (req, res) => {
    try {
        if (!isDbConnected) return res.status(503).json({ error: 'Database unavailable. Check MongoDB connection.' });
        const post = await CommunityPost.findById(req.params.id);
        if (!post) return res.status(404).json({ error: 'Post not found' });

        const requesterEmail = normalizeEmail(req.body.email);
        const requesterName = String(req.body.name || '').trim();
        const requesterTeam = String(req.body.teamName || '').trim();
        const requesterPhone = String(req.body.phone || '').trim();
        const requesterStatus = ['Accepted', 'Rejected', 'Pending'].includes(req.body.status) ? req.body.status : 'Pending';
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

        post.requests.push({
            name: requesterName,
            teamName: requesterTeam,
            phone: requesterPhone,
            email: requesterEmail,
            message: String(req.body.message || '').trim(),
            status: requesterStatus,
            paymentMethod: 'UPI',
            paymentStatus,
            paymentAmount,
            upiTransactionId
        });

        if (post.postType === 'team' && requesterStatus === 'Accepted') {
            post.status = 'Matched';
        }
        if (post.postType === 'tournament' && post.maxTeams > 0 && post.requests.length >= post.maxTeams) {
            post.status = 'Full';
        }

        await post.save();
        res.status(201).json(post);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.patch('/api/community/:postId/request/:requestId', async (req, res) => {
    try {
        if (!isDbConnected) return res.status(503).json({ error: 'Database unavailable. Check MongoDB connection.' });
        const { status } = req.body;
        if (!['Accepted', 'Rejected', 'Pending'].includes(status)) {
            return res.status(400).json({ error: 'status must be Accepted, Rejected, or Pending.' });
        }

        const post = await CommunityPost.findById(req.params.postId);
        if (!post) return res.status(404).json({ error: 'Post not found' });

        const requestEntry = post.requests.id(req.params.requestId);
        if (!requestEntry) return res.status(404).json({ error: 'Request not found' });

        const previousStatus = requestEntry.status;
        if (post.postType === 'solo') {
            if (status === 'Accepted' && previousStatus !== 'Accepted') {
                if (post.spots <= 0) {
                    return res.status(400).json({ error: 'No spots remaining.' });
                }
                post.spots -= 1;
            }
            if (previousStatus === 'Accepted' && status !== 'Accepted') {
                post.spots += 1;
            }
            if (post.spots <= 0) {
                post.status = 'Full';
            } else if (post.status === 'Full') {
                post.status = 'Open';
            }
        }

        if (post.postType === 'team') {
            if (status === 'Accepted') {
                post.requests.forEach(entry => {
                    if (String(entry._id) !== String(requestEntry._id) && entry.status === 'Accepted') {
                        entry.status = 'Rejected';
                    }
                });
                post.status = 'Matched';
            } else if (previousStatus === 'Accepted' && status !== 'Accepted') {
                post.status = 'Open';
            }
        }

        requestEntry.status = status;
        await post.save();
        res.json(post);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, HOST, () => {
    console.log('\n================================');
    console.log('🚀 TurfArena Backend Live!');
    console.log(`📡 Host: ${HOST}`);
    console.log(`📡 Port: ${PORT}`);
    console.log('================================\n');
});
