# TurfArena Backend Code Explanation

This note explains the backend code in a way you can present to a Database Management Systems professor. The backend file is:

`backend/server.js`

The backend is built using:

- `Express.js` for creating API routes.
- `mysql2/promise` for connecting Node.js with MySQL.
- `cors` for allowing frontend requests.
- `dotenv` for reading environment variables.
- `path` for handling file paths.

## 1. Basic Backend Flow

The backend works in this order:

1. Import required packages.
2. Create an Express app.
3. Configure MySQL connection pool.
4. Add middleware for CORS, JSON body parsing, and static frontend files.
5. Define helper functions.
6. Define API routes.
7. Connect to the database.
8. Seed default admin and default turfs.
9. Start the server.

## 2. Package Imports

```js
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
```

Explanation:

- `express` creates the backend server and routes.
- `mysql2/promise` lets us write SQL queries using `async/await`.
- `cors` allows the frontend to communicate with the backend.
- `path` safely builds file paths.
- `dotenv` loads database credentials and app settings from `.env`.

Professor explanation:

"The backend uses Express for the REST API and mysql2 for SQL database connectivity. The promise version is used so all database operations can be handled using async-await."

## 3. Server Configuration

```js
const app = express();

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 5001);
```

Explanation:

- `app` is the Express application.
- `HOST` and `PORT` define where the backend runs.
- If `.env` values are missing, default values are used.

## 4. MySQL Connection Pool

```js
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
```

Explanation:

- A connection pool manages multiple reusable database connections.
- It is better than opening a new database connection for every request.
- `connectionLimit: 10` means up to 10 database connections can be used at once.

Professor explanation:

"I used a MySQL connection pool to improve efficiency. Instead of creating and closing a database connection for every query, the pool reuses connections."

DBMS concept:

- Database connectivity
- Connection pooling
- Client-server architecture

## 5. Middleware

```js
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
```

Explanation:

- `cors` allows frontend JavaScript to call backend APIs.
- `express.json()` allows the backend to read JSON request bodies.

Example:

If frontend sends:

```json
{
  "email": "user@example.com",
  "password": "12345"
}
```

then `express.json()` makes it available as:

```js
req.body.email
req.body.password
```

## 6. Static File Serving

```js
app.use(express.static(FRONTEND_ROOT, {
    index: 'index.html',
    fallthrough: true
}));
```

Explanation:

- This serves HTML, CSS, JS, and image files from the project root.
- It allows the same backend server to host the frontend pages.

## 7. Helper Functions

### 7.1 normalizeEmail()

```js
function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
}
```

Purpose:

- Converts emails to lowercase.
- Removes extra spaces.
- Helps avoid duplicate emails like `Test@gmail.com` and `test@gmail.com`.

DBMS concept:

- Data cleaning before insertion.
- Maintaining consistency.

### 7.2 parseAmount()

```js
function parseAmount(value, fallback = 0) {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) && numericValue >= 0 ? numericValue : fallback;
}
```

Purpose:

- Converts price, fare, refund amount, and payment amount to valid numbers.
- Prevents invalid negative amounts.

### 7.3 normalizeSlots()

```js
function normalizeSlots(slots) {
    if (!Array.isArray(slots)) return [];
    return [...new Set(
        slots
            .map(slot => parseInt(slot, 10))
            .filter(Number.isInteger)
            .filter(slot => slot >= 0 && slot <= 23)
    )].sort((a, b) => a - b);
}
```

Purpose:

- Accepts selected booking slots from frontend.
- Converts them into integers.
- Removes duplicate slots.
- Allows only valid hours from `0` to `23`.
- Sorts the slots.

Professor explanation:

"Before inserting booking slots, I validate them in the backend and also enforce a database CHECK constraint. So validation exists at both application level and database level."

## 8. Data Mapping Functions

The backend has mapping functions such as:

- `mapTurfRow()`
- `mapBookingRow()`
- `mapRequestRow()`
- `mapCommunityPostRow()`

Purpose:

- SQL returns rows using database column names like `base_price`.
- Frontend expects JavaScript-style names like `basePrice`.
- Mapping functions convert SQL rows into frontend-friendly JSON.

Example:

```js
function mapTurfRow(row, relations = {}) {
    return {
        _id: String(row.turf_id),
        name: row.name,
        basePrice: Number(row.base_price || 0),
        sports: relations.sports || []
    };
}
```

Professor explanation:

"The database uses normalized table columns, while the frontend consumes JSON objects. Mapping functions convert relational rows into structured API responses."

## 9. Database Connection Check

```js
async function checkDatabaseConnection() {
    const connection = await pool.getConnection();
    try {
        await connection.query('SELECT 1');
        isDbConnected = true;
    } finally {
        connection.release();
    }
}
```

Explanation:

- Gets one database connection from the pool.
- Runs `SELECT 1` to test if MySQL is connected.
- Releases the connection back to the pool.

DBMS concept:

- Connection testing
- Resource release

## 10. Default Data Seeding

The backend creates default data if needed:

- `ensureDefaultAdmin()`
- `ensureDefaultTurfs()`

Purpose:

- Adds one admin user if not present.
- Adds sample turfs if the turf table is empty.

Professor explanation:

"Seeding is used to insert initial records required for the application demo, such as admin login and sample turf data."

## 11. Authentication Routes

### 11.1 User Registration

Route:

```http
POST /api/auth/register
```

Code operation:

1. Read `name`, `phone`, `email`, and `password` from request body.
2. Validate required fields.
3. Normalize email.
4. Check if email already exists.
5. Insert new user into `users`.
6. Return created user data.

SQL used:

```sql
SELECT user_id FROM users WHERE email = ? LIMIT 1;

INSERT INTO users (name, phone, email, password, role)
VALUES (?, ?, ?, ?, 'user');
```

DBMS concepts:

- `SELECT`
- `INSERT`
- Unique email validation
- Primary key auto increment

Professor explanation:

"During registration, the backend first checks whether the email already exists. If not, it inserts the user record into the users table."

### 11.2 User Login

Route:

```http
POST /api/auth/login
```

Code operation:

1. Read email and password.
2. Find user by email.
3. Compare stored password with entered password.
4. Return user details if valid.

SQL used:

```sql
SELECT * FROM users WHERE email = ? LIMIT 1;
```

Important note:

For a college DBMS demo this is acceptable, but in production passwords should be hashed using bcrypt.

## 12. User Route

Route:

```http
GET /api/users
```

Purpose:

- Returns all users.
- Used mainly for admin view.

SQL used:

```sql
SELECT user_id, name, email, phone, role, created_at, updated_at
FROM users
ORDER BY created_at DESC;
```

DBMS concept:

- Projection: selecting only required columns.
- Sorting using `ORDER BY`.

## 13. Turf Routes

### 13.1 Get All Turfs

Route:

```http
GET /api/turfs
```

Purpose:

- Fetch all turf records.
- Also fetch related sports and reviews.

Tables involved:

- `turfs`
- `turf_sports`
- `turf_reviews`

SQL examples:

```sql
SELECT * FROM turfs ORDER BY created_at DESC;
SELECT turf_id, sport_name FROM turf_sports WHERE turf_id IN (...);
SELECT * FROM turf_reviews WHERE turf_id IN (...);
```

Professor explanation:

"Turfs, sports, and reviews are stored in separate normalized tables. The backend combines them into one JSON response for the frontend."

### 13.2 Add Turf

Route:

```http
POST /api/turfs
```

Purpose:

- Admin adds a new turf.
- Sports are inserted into `turf_sports`.

Important concept:

This route uses a transaction.

```js
await connection.beginTransaction();
...
await connection.commit();
```

Why transaction is used:

- A turf and its sports must be inserted together.
- If sports insertion fails, turf insertion should also be cancelled.

Professor explanation:

"I used transaction control for turf creation because inserting a turf and inserting its supported sports are related operations. Either both should succeed or both should fail."

DBMS concept:

- Transaction
- Atomicity
- Rollback
- Foreign key relationship

### 13.3 Update Turf

Route:

```http
PATCH /api/turfs/:id
```

Purpose:

- Updates turf details.
- Deletes old sports and inserts the updated sport list.

SQL operations:

```sql
UPDATE turfs SET ... WHERE turf_id = ?;
DELETE FROM turf_sports WHERE turf_id = ?;
INSERT INTO turf_sports (turf_id, sport_name) VALUES (?, ?);
```

Why delete and reinsert sports:

- The frontend sends the complete updated list of sports.
- Replacing the child records is simpler and keeps data synchronized.

### 13.4 Delete Turf

Route:

```http
DELETE /api/turfs/:id
```

SQL used:

```sql
DELETE FROM turfs WHERE turf_id = ?;
```

DBMS concept:

- Since child tables use `ON DELETE CASCADE`, related sports, reviews, and bookings are deleted automatically when a turf is deleted.

## 14. Turf Review Routes

### 14.1 Add or Update Turf Review

Route:

```http
POST /api/turfs/:id/reviews
```

SQL used:

```sql
INSERT INTO turf_reviews (turf_id, user_name, user_email, rating, comment)
VALUES (?, ?, ?, ?, ?)
ON DUPLICATE KEY UPDATE
    user_name = VALUES(user_name),
    rating = VALUES(rating),
    comment = VALUES(comment),
    updated_at = CURRENT_TIMESTAMP;
```

Explanation:

- One user can give only one review per turf.
- The unique key `(turf_id, user_email)` enforces this.
- If the user reviews again, the old review is updated.

Professor explanation:

"The composite unique key prevents duplicate reviews from the same user for the same turf. I used `ON DUPLICATE KEY UPDATE` to implement review update behavior."

### 14.2 Delete Turf Review

Route:

```http
DELETE /api/turfs/:id/reviews
```

SQL used:

```sql
DELETE FROM turf_reviews
WHERE turf_id = ? AND user_email = ?;
```

## 15. Booking Routes

### 15.1 Get All Bookings

Route:

```http
GET /api/bookings
```

Purpose:

- Returns all bookings with their slots and turf details.

Tables involved:

- `bookings`
- `booking_slots`
- `turfs`
- `turf_sports`
- `turf_reviews`

Important design point:

`booking_slots` is separate because one booking can contain multiple hourly slots.

Professor explanation:

"Instead of storing slots as a comma-separated string, I created a separate booking_slots table. This follows normalization and supports one-to-many relationship between booking and slots."

### 15.2 Create Booking

Route:

```http
POST /api/bookings
```

Code operation:

1. Read turf ID, user details, selected date, and selected slots.
2. Validate selected slots.
3. Start transaction.
4. Insert one row into `bookings`.
5. Insert multiple rows into `booking_slots`.
6. Commit transaction.

SQL used:

```sql
INSERT INTO bookings
(turf_id, user_name, user_email, booking_date, status, payment_method, payment_status, upi_transaction_id, refund_status, refund_amount, cancelled_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);

INSERT INTO booking_slots (booking_id, slot_hour)
VALUES (?, ?);
```

DBMS concepts:

- One-to-many relationship
- Foreign key
- Transaction
- Atomicity
- Insert into parent table first, then child table

Professor explanation:

"A booking is first inserted into the bookings table. Then each selected slot is inserted into booking_slots using the generated booking_id as foreign key."

### 15.3 Cancel Booking

Route:

```http
PATCH /api/bookings/:id
```

Purpose:

- Updates booking status to `Cancelled`.
- Calculates refund eligibility.
- Updates refund status and amount.

SQL used:

```sql
UPDATE bookings
SET status = 'Cancelled',
    cancelled_at = NOW(),
    refund_status = ?,
    refund_amount = ?,
    updated_at = CURRENT_TIMESTAMP
WHERE booking_id = ?;
```

Business rule:

- If cancellation happens at least 30 minutes before slot start time, refund is given.
- Otherwise refund is not eligible.

## 16. Payment Intent Route

Route:

```http
POST /api/payments/intent
```

Purpose:

- Creates a UPI payment intent.
- Returns UPI payment URL and reference.

Important note:

This is a mock/client-confirmed payment flow. It is suitable for project demo, not real production payment verification.

## 17. Community Routes

### 17.1 Get Community Posts

Route:

```http
GET /api/community
```

Purpose:

- Returns community posts with requests and reviews.

Tables involved:

- `community_posts`
- `community_requests`
- `community_reviews`

### 17.2 Create Community Post

Route:

```http
POST /api/community
```

Purpose:

- Creates solo, team, or tournament post.

Validation:

- `postType` must be `solo`, `team`, or `tournament`.
- Solo posts must have available spots.
- Tournament posts can be created only by admin.
- Tournament posts require event date.

SQL used:

```sql
INSERT INTO community_posts
(post_type, sport, team_name, turf, spots, fare, prize_pool, event_date, event_time, max_teams, status, created_by)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
```

DBMS concept:

- Controlled values using application validation and database `CHECK` constraints.

### 17.3 Update Community Post

Route:

```http
PATCH /api/community/:id
```

Purpose:

- Updates post status, turf, fare, date, time, max teams, and available spots.

SQL used:

```sql
UPDATE community_posts
SET status = ?, turf = ?, fare = ?, prize_pool = ?, event_date = ?, event_time = ?, max_teams = ?, spots = ?, updated_at = CURRENT_TIMESTAMP
WHERE post_id = ?;
```

### 17.4 Delete Community Post

Route:

```http
DELETE /api/community/:id
```

SQL used:

```sql
DELETE FROM community_posts WHERE post_id = ?;
```

DBMS concept:

- `ON DELETE CASCADE` removes related requests and reviews.

## 18. Community Request Routes

### 18.1 Create Request

Route:

```http
POST /api/community/:id/request
```

Purpose:

- Allows user or team to respond to community post.

Validation:

- User cannot respond to own post.
- Duplicate request is not allowed.
- Tournament requires team name, phone, and UPI transaction ID.
- Tournament cannot exceed maximum team count.

SQL used:

```sql
INSERT INTO community_requests
(post_id, name, team_name, phone, email, message, status, payment_method, payment_status, payment_amount, upi_transaction_id)
VALUES (?, ?, ?, ?, ?, ?, ?, 'UPI', ?, ?, ?);
```

DBMS concept:

- `community_requests.post_id` is a foreign key.
- Unique key `(post_id, email)` prevents the same user from sending multiple requests to the same post.

### 18.2 Accept or Reject Request

Route:

```http
PATCH /api/community/:postId/request/:requestId
```

Purpose:

- Admin or post owner can update request status.
- Solo post acceptance decreases spots.
- Team post acceptance rejects other pending/accepted requests and marks post as matched.

Important concept:

This route uses a transaction because request status and post status/spots must update together.

Professor explanation:

"When accepting a community request, the request table and community post table are both updated. Therefore, transaction control is used to maintain consistency."

### 18.3 Delete Request

Route:

```http
DELETE /api/community/:postId/request/:requestId
```

Purpose:

- Deletes a request.
- If an accepted solo request is deleted, available spots increase again.
- If a tournament request is deleted and tournament was full, status can reopen.

## 19. Community Review Route

Route:

```http
POST /api/community/:id/reviews
```

Purpose:

- Adds or updates a review for a community post.

SQL used:

```sql
INSERT INTO community_reviews (post_id, user_name, user_email, rating, comment)
VALUES (?, ?, ?, ?, ?)
ON DUPLICATE KEY UPDATE
    user_name = VALUES(user_name),
    rating = VALUES(rating),
    comment = VALUES(comment),
    updated_at = CURRENT_TIMESTAMP;
```

DBMS concept:

- Composite unique key `(post_id, user_email)` ensures one review per user per post.

## 20. Server Startup

```js
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
        console.log('TurfArena Backend Live!');
    });
}

startServer();
```

Explanation:

- Checks database connection.
- Seeds default data.
- Starts the Express server.

Professor explanation:

"When the backend starts, it verifies database connectivity, ensures required demo data exists, and then listens for API requests."

## 21. Important DBMS Concepts Used in This Backend

- Primary keys uniquely identify rows.
- Foreign keys connect child tables to parent tables.
- Unique constraints prevent duplicate emails, duplicate sport entries, duplicate reviews, and duplicate requests.
- Check constraints restrict invalid values such as wrong role, invalid rating, or invalid slot hour.
- Transactions are used when multiple related SQL operations must succeed or fail together.
- Cascading delete automatically removes dependent records.
- Normalization is used by separating multi-valued data into child tables.
- SQL queries use placeholders `?` to avoid direct string concatenation and reduce SQL injection risk.

## 22. Best Viva Questions and Answers

### Q1. Why did you use `booking_slots` instead of storing slots in `bookings`?

Because one booking can contain multiple slots. Storing multiple values in one column would violate normalization. So I created a separate `booking_slots` table with `booking_id` as a foreign key.

### Q2. Why did you use transactions?

Transactions are used when multiple related operations must be treated as one unit. For example, creating a booking inserts into `bookings` and `booking_slots`. If slot insertion fails, the booking should also be rolled back.

### Q3. What is the role of foreign keys?

Foreign keys maintain relationships between tables and prevent invalid references. For example, `booking_slots.booking_id` must refer to an existing booking.

### Q4. Where have you used normalization?

I normalized turf sports, booking slots, turf reviews, community requests, and community reviews into separate tables instead of storing repeated values in one table.

### Q5. What is `ON DELETE CASCADE`?

It automatically deletes child records when the parent record is deleted. For example, if a turf is deleted, its related sports and reviews are deleted automatically.

### Q6. What does `ON DUPLICATE KEY UPDATE` do?

It inserts a record if it does not exist. If a unique key conflict happens, it updates the existing record. I used it for reviews so one user can update their existing review.

### Q7. How do you prevent duplicate user registration?

The backend checks if the email already exists, and the database also has a unique constraint on `users.email`.

### Q8. How do you connect Node.js to MySQL?

The backend uses the `mysql2/promise` package and creates a connection pool with database host, user, password, and database name.

### Q9. What is the difference between `GET`, `POST`, `PATCH`, and `DELETE`?

- `GET` reads data.
- `POST` creates new data.
- `PATCH` updates existing data.
- `DELETE` removes data.

### Q10. Is this backend fully production-ready?

It is suitable for a DBMS project demo. For production, passwords should be hashed, authentication tokens should be added, and real payment verification should be integrated.

## 23. Short Explanation You Can Say in Demo

"My project backend is built using Node.js, Express.js, and MySQL. The backend exposes REST API routes for user authentication, turf management, booking management, payments, reviews, and community features. I used a normalized relational schema where repeated data such as turf sports, booking slots, reviews, and community requests are stored in separate tables. The backend uses SQL queries with placeholders, foreign keys, unique constraints, check constraints, and transactions. Transactions are used in important operations like creating bookings and updating community requests to maintain consistency."

