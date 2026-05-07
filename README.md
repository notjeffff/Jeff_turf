# TurfArena

TurfArena is a DBMS mini project for turf booking and community sports management. It combines a static HTML/CSS/JavaScript frontend with a Node.js + Express backend and a MySQL relational database.

The project lets users browse turfs, register/login, book hourly slots, pay using UPI flow metadata, review turfs, and participate in community sports posts such as solo matches, team events, and tournaments. It also includes an admin side for managing turfs and platform activity.

## Features

- User registration and login
- Admin login and dashboard
- Turf listing with pricing, sports, images, and panorama support
- Multi-slot turf booking by date
- Booking cancellation and refund eligibility logic
- UPI payment intent/config endpoints
- Turf review system
- Community posts for solo, team, and tournament activities
- Join requests and review support for community events
- MySQL schema with primary keys, foreign keys, unique constraints, and checks

## Tech Stack

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js, Express.js
- Database: MySQL
- Libraries: `mysql2`, `cors`, `dotenv`, `nodemon`

## Project Structure

```text
.
├── index.html
├── login.html
├── user-login.html
├── admin-login.html
├── user-dashboard.html
├── admin-dashboard.html
├── community.html
├── css/
├── js/
├── backend/
│   ├── server.js
│   ├── .env.example
│   ├── package.json
│   ├── SQL_MIGRATION_GUIDE.md
│   └── sql/
│       └── schema.sql
├── DATABASE_DESIGN.md
├── BACKEND_CODE_EXPLANATION.md
└── LICENSE
```

## Database Design

The database is normalized for DBMS submission and implementation. Main tables:

- `users`
- `turfs`
- `turf_sports`
- `turf_reviews`
- `bookings`
- `booking_slots`
- `community_posts`
- `community_requests`
- `community_reviews`

Detailed explanation is available in [DATABASE_DESIGN.md](/Users/jeffherbert/Desktop/SEM-4/DBMS/DA3_USING SQL/DATABASE_DESIGN.md) and the SQL schema is in [backend/sql/schema.sql](/Users/jeffherbert/Desktop/SEM-4/DBMS/DA3_USING SQL/backend/sql/schema.sql).

## Setup

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd "DA3_USING SQL"
```

### 2. Create the MySQL database

Open MySQL and run:

```sql
SOURCE backend/sql/schema.sql;
```

This creates the `turfarena_sql` database, required tables, default admin, and sample turf data.

### 3. Configure environment variables

Inside `backend/`, create a `.env` file based on `.env.example`.

Example:

```env
HOST=127.0.0.1
PORT=5001

DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=turfarena_sql

ADMIN_EMAIL=admin@turfarena.com
ADMIN_PASSWORD=admin123

UPI_ID=turfarena@upi
UPI_NAME=TurfArena
UPI_NOTE_PREFIX=TurfArena
```

### 4. Install backend dependencies

```bash
cd backend
npm install
```

### 5. Run the server

Development mode:

```bash
npm run dev
```

Production mode:

```bash
npm start
```

The backend runs by default at:

```text
http://127.0.0.1:5001
```

Because the backend also serves the frontend statically, open:

```text
http://127.0.0.1:5001
```

## Main Pages

- `/` or `index.html` - landing page
- `/login.html` - common login selection
- `/user-login.html` - user authentication
- `/admin-login.html` - admin authentication
- `/user-dashboard.html` - user dashboard
- `/admin-dashboard.html` - admin dashboard
- `/community.html` - community sports section

## API Overview

Implemented API groups in `backend/server.js`:

- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/users`
- `GET /api/turfs`
- `POST /api/turfs`
- `PATCH /api/turfs/:id`
- `POST /api/turfs/:id/reviews`
- `DELETE /api/turfs/:id/reviews`
- `DELETE /api/turfs/:id`
- `GET /api/bookings`
- `POST /api/bookings`
- `PATCH /api/bookings/:id`
- `GET /api/community`
- `POST /api/community`
- `PATCH /api/community/:id`
- `DELETE /api/community/:id`
- `POST /api/community/:id/request`
- `PATCH /api/community/:postId/request/:requestId`
- `DELETE /api/community/:postId/request/:requestId`
- `POST /api/community/:id/reviews`
- `GET /api/payments/config`
- `POST /api/payments/intent`

## Default Admin Login

The default admin created by the schema/setup is:

- Email: `admin@turfarena.com`
- Password: `admin123`

Change these values in production or before public sharing.


## License

This project includes a [LICENSE](/Users/jeffherbert/Desktop/SEM-4/DBMS/DA3_USING SQL/LICENSE) file.
