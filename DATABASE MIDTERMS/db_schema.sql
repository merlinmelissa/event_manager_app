-- This makes sure that foreign_key constraints are observed and that errors will be thrown for violations
PRAGMA foreign_keys=ON;

BEGIN TRANSACTION;

-- Organiser table for storing organiser information (passwords NOT stored here)
CREATE TABLE IF NOT EXISTS organisers (
    organiser_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT NOT NULL
);

-- Site settings table for site name and description
CREATE TABLE IF NOT EXISTS site_settings (
    setting_id INTEGER PRIMARY KEY AUTOINCREMENT,
    site_name TEXT NOT NULL DEFAULT 'Event Manager',
    site_description TEXT NOT NULL DEFAULT 'Manage your events efficiently'
);

-- Events table for storing event information
CREATE TABLE IF NOT EXISTS events (
    event_id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    event_date TEXT, -- Store as ISO date string (YYYY-MM-DD HH:MM:SS)
    full_price_tickets INTEGER DEFAULT 0,
    full_price_cost REAL DEFAULT 0.00,
    concession_tickets INTEGER DEFAULT 0,
    concession_cost REAL DEFAULT 0.00,
    status TEXT DEFAULT 'draft', -- 'draft' or 'published'
    organiser_id INTEGER,
    created_date TEXT DEFAULT CURRENT_TIMESTAMP,
    published_date TEXT,
    last_modified TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organiser_id) REFERENCES organisers(organiser_id) ON DELETE SET NULL
);

-- Bookings table for storing ticket bookings
CREATE TABLE IF NOT EXISTS bookings (
    booking_id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    attendee_name TEXT NOT NULL,
    full_price_tickets_booked INTEGER DEFAULT 0,
    concession_tickets_booked INTEGER DEFAULT 0,
    total_cost REAL DEFAULT 0.00,
    booking_date TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(event_id) ON DELETE CASCADE
);

-- Insert sample organisers (passwords are handled via environment variables)
INSERT INTO organisers (name, description) VALUES 
('Sarah Johnson', 'Lead Yoga Instructor and Studio Manager'),
('Mike Chen', 'Assistant Instructor and Event Coordinator');

-- Insert default site settings
INSERT INTO site_settings (site_name, site_description) VALUES 
('Fun Yoga', 'All kinds of yoga for all ages');

-- Insert some sample events for testing (now with organiser_id)
INSERT INTO events (title, description, event_date, full_price_tickets, full_price_cost, concession_tickets, concession_cost, status, organiser_id, published_date) 
VALUES ('Yoga Kids Workshop', 'Beginner friendly kids yoga session', '2025-07-15 10:00:00', 20, 25.00, 10, 15.00, 'published', 1, CURRENT_TIMESTAMP);

INSERT INTO events (title, description, event_date, full_price_tickets, full_price_cost, concession_tickets, concession_cost, status, organiser_id) 
VALUES ('Yoga Adults Workshop', 'Beginner friendly adults yoga session', '2025-07-20 14:00:00', 30, 15.00, 15, 10.00, 'draft', 2);

INSERT INTO events (title, description, event_date, full_price_tickets, full_price_cost, concession_tickets, concession_cost, status, organiser_id, published_date) 
VALUES ('Puppy Yoga', 'Yoga with cute puppies', '2025-07-10 09:00:00', 15, 40.00, 5, 30.00, 'published', 1, CURRENT_TIMESTAMP);

-- Insert some sample bookings
INSERT INTO bookings (event_id, attendee_name, full_price_tickets_booked, concession_tickets_booked, total_cost) 
VALUES (1, 'Alice Benson', 2, 1, 65.00);

INSERT INTO bookings (event_id, attendee_name, full_price_tickets_booked, concession_tickets_booked, total_cost) 
VALUES (3, 'Bob Carrey', 1, 0, 40.00);

COMMIT;