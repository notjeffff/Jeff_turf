# SQL Migration Guide For This Project

## What You Should Do

For your DBMS project, the easiest good approach is:

1. Keep the frontend as it is.
2. Replace the MongoDB backend with a MySQL backend.
3. Use proper SQL tables for reviews, bookings, slots, community posts, and requests.
4. Show your ER diagram, schema, keys, and SQL queries in the project demo/report.

You do **not** need to redesign the whole app from zero. Your current project already has a clean structure. We just need to convert the backend database layer from MongoDB documents to SQL tables.

## Why SQL Is Better Here

MongoDB stores nested arrays inside documents:

- turf reviews inside `Turf`
- booking slots inside `Booking`
- requests inside `CommunityPost`
- reviews inside `CommunityPost`

For a DBMS project, that is not ideal because faculty usually expects:

- normalized tables
- primary keys
- foreign keys
- joins
- constraints
- relational design

That is why I created [`backend/sql/schema.sql`](/Users/jeffherbert/Desktop/SEM-4/DBMS/DA3_USING SQL/backend/sql/schema.sql) for your project.

## Table Mapping From MongoDB To SQL

Your current Mongo collections map like this:

- `User` -> `users`
- `Turf` -> `turfs`
- `Turf.sports[]` -> `turf_sports`
- `Turf.reviews[]` -> `turf_reviews`
- `Booking` -> `bookings`
- `Booking.slots[]` -> `booking_slots`
- `CommunityPost` -> `community_posts`
- `CommunityPost.requests[]` -> `community_requests`
- `CommunityPost.reviews[]` -> `community_reviews`

This is the correct relational conversion for your current app.

## Best Database Choice

Use `MySQL` for this project.

Why:

- simple to install
- easy `CREATE TABLE`, `JOIN`, `GROUP BY`
- commonly accepted for DBMS college projects
- works well with Node.js using `mysql2`

## Backend Changes You Need

The backend is now written against SQL tables, and [`backend/server.js`](/Users/jeffherbert/Desktop/SEM-4/DBMS/DA3_USING SQL/backend/server.js) uses:

- `mysql2`
- normalized relational tables
- SQL queries instead of embedded MongoDB documents

To convert it:

1. Remove Mongoose connection code.
2. Install `mysql2`.
3. Create one DB connection file.
4. Replace Mongoose model operations with SQL queries.

Examples:

- `User.findOne({ email })` -> `SELECT * FROM users WHERE email = ?`
- `User.create(...)` -> `INSERT INTO users (...) VALUES (...)`
- `Turf.find()` -> `SELECT * FROM turfs ORDER BY created_at DESC`
- `Booking.find().populate('turfId')` -> `SELECT ... FROM bookings b JOIN turfs t ON b.turf_id = t.turf_id`
- embedded review updates -> `INSERT ... ON DUPLICATE KEY UPDATE`

## Important SQL Concepts To Show In Viva / Report

Make sure you can explain these:

1. `PRIMARY KEY`
2. `FOREIGN KEY`
3. `UNIQUE`
4. `CHECK`
5. `JOIN`
6. normalization
7. why `booking_slots` is a separate table
8. why `community_requests` is a separate table

## What To Submit

For a solid DBMS submission, prepare:

1. project screenshots
2. ER diagram
3. relational schema
4. SQL file
5. a few sample queries
6. brief explanation of tables and relationships

## Recommended Next Technical Step

If you want the app to actually run fully on SQL, do this next:

1. install `mysql2`
2. create `backend/db.js`
3. rewrite API routes in [`backend/server.js`](/Users/jeffherbert/Desktop/SEM-4/DBMS/DA3_USING SQL/backend/server.js) to SQL
4. test login, turf listing, bookings, and community features

## If You Want The Minimum Effort Version

If your goal is only the DBMS project submission and not a full production migration, then this is enough:

1. keep your UI same
2. keep backend logic as reference
3. present the SQL schema
4. explain how Mongo collections were normalized into SQL tables

That is often acceptable in college if the requirement is mainly to show relational database design.

## My Honest Recommendation

For your project, the best move is:

- use `MySQL`
- keep the same project idea and UI
- rewrite only the backend database layer
- use the schema file I added as your base

If you want, I can do the next step too: convert your current Node backend from MongoDB to MySQL route by route.
