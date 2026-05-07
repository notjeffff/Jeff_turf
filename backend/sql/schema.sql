CREATE DATABASE IF NOT EXISTS turfarena_sql;
USE turfarena_sql;

CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(120) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CHECK (role IN ('user', 'admin'))
);

CREATE TABLE turfs (
    turf_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    meta VARCHAR(255),
    location VARCHAR(120),
    base_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
    panorama_url TEXT,
    image VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE turf_sports (
    turf_sport_id INT AUTO_INCREMENT PRIMARY KEY,
    turf_id INT NOT NULL,
    sport_name VARCHAR(50) NOT NULL,
    FOREIGN KEY (turf_id) REFERENCES turfs(turf_id) ON DELETE CASCADE,
    UNIQUE KEY unique_turf_sport (turf_id, sport_name)
);

CREATE TABLE turf_reviews (
    turf_review_id INT AUTO_INCREMENT PRIMARY KEY,
    turf_id INT NOT NULL,
    user_name VARCHAR(100) NOT NULL,
    user_email VARCHAR(120) NOT NULL,
    rating INT NOT NULL,
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (turf_id) REFERENCES turfs(turf_id) ON DELETE CASCADE,
    UNIQUE KEY unique_turf_reviewer (turf_id, user_email),
    CHECK (rating BETWEEN 1 AND 5)
);

CREATE TABLE bookings (
    booking_id INT AUTO_INCREMENT PRIMARY KEY,
    turf_id INT NOT NULL,
    user_name VARCHAR(100) NOT NULL,
    user_email VARCHAR(120) NOT NULL,
    booking_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Confirmed',
    payment_method VARCHAR(30) DEFAULT 'UPI',
    payment_status VARCHAR(20) NOT NULL DEFAULT 'Pending',
    upi_transaction_id VARCHAR(100),
    refund_status VARCHAR(30) NOT NULL DEFAULT 'Not Requested',
    refund_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    cancelled_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (turf_id) REFERENCES turfs(turf_id) ON DELETE CASCADE,
    CHECK (status IN ('Pending', 'Confirmed', 'Cancelled')),
    CHECK (payment_status IN ('Pending', 'Paid')),
    CHECK (refund_status IN ('Not Requested', 'Not Eligible', 'Refunded'))
);

CREATE TABLE booking_slots (
    booking_slot_id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL,
    slot_hour INT NOT NULL,
    FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE,
    UNIQUE KEY unique_booking_slot (booking_id, slot_hour),
    CHECK (slot_hour BETWEEN 0 AND 23)
);

CREATE TABLE community_posts (
    post_id INT AUTO_INCREMENT PRIMARY KEY,
    post_type VARCHAR(20) NOT NULL,
    sport VARCHAR(50) NOT NULL DEFAULT 'Football',
    team_name VARCHAR(120) NOT NULL,
    turf VARCHAR(120) DEFAULT '',
    spots INT NOT NULL DEFAULT 0,
    fare DECIMAL(10, 2) NOT NULL DEFAULT 0,
    prize_pool VARCHAR(120) DEFAULT '',
    event_date DATE NULL,
    event_time TIME NULL,
    max_teams INT NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'Open',
    created_by VARCHAR(120) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CHECK (post_type IN ('solo', 'team', 'tournament'))
);

CREATE TABLE community_requests (
    request_id INT AUTO_INCREMENT PRIMARY KEY,
    post_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    team_name VARCHAR(120),
    phone VARCHAR(20),
    email VARCHAR(120) NOT NULL,
    message TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'Pending',
    payment_method VARCHAR(30) DEFAULT 'UPI',
    payment_status VARCHAR(20) NOT NULL DEFAULT 'Pending',
    payment_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    upi_transaction_id VARCHAR(100),
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES community_posts(post_id) ON DELETE CASCADE,
    UNIQUE KEY unique_post_email (post_id, email),
    CHECK (status IN ('Pending', 'Accepted', 'Rejected')),
    CHECK (payment_status IN ('Not Required', 'Pending', 'Paid'))
);

CREATE TABLE community_reviews (
    review_id INT AUTO_INCREMENT PRIMARY KEY,
    post_id INT NOT NULL,
    user_name VARCHAR(100) NOT NULL,
    user_email VARCHAR(120) NOT NULL,
    rating INT NOT NULL,
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES community_posts(post_id) ON DELETE CASCADE,
    UNIQUE KEY unique_post_reviewer (post_id, user_email),
    CHECK (rating BETWEEN 1 AND 5)
);

INSERT INTO users (name, email, password, phone, role)
VALUES ('TurfArena Admin', 'admin@turfarena.com', 'admin123', '0000000000', 'admin');

INSERT INTO turfs (name, meta, location, base_price, panorama_url, image) VALUES
('GreenLine Arena', 'Velachery • Football, Cricket', 'Velachery', 1200, 'https://pannellum.org/images/alma.jpg', 'aerial-view-grass-field-hockey.jpg'),
('Boundary Line Turf', 'Tambaram • Cricket box', 'Tambaram', 800, '', 'izuddin-helmi-adnan-K5ChxJaheKI-unsplash.jpg'),
('SkyLine Sports Hub', 'OMR • Multi-sport', 'OMR', 1000, '', 'thomas-park-fDmpxdV69eA-unsplash.jpg');

INSERT INTO turf_sports (turf_id, sport_name) VALUES
(1, 'Football'),
(1, 'Cricket'),
(2, 'Cricket'),
(3, 'Football'),
(3, 'Cricket');
