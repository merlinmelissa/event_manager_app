/**
* index.js
* This is your main app entry point
*/

// Load environment variables (install with: npm install dotenv)
require('dotenv').config();

// Set up express, bodyparser and EJS
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;
var bodyParser = require("body-parser");
const session = require('express-session');

app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs'); // set the app to use ejs for rendering
app.use(express.static(__dirname + '/public')); // set location of static files

// Set up session middleware with environment variable
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-this-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production', // Only secure cookies in production
        httpOnly: true, // Prevents XSS access to cookies
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Database setup - Initialize SQLite connection
// Input: database file path, Output: global db connection object
const sqlite3 = require('sqlite3').verbose();
global.db = new sqlite3.Database('./database.db',function(err){
    if(err){
        console.error(err);
        process.exit(1); // bail out we can't connect to the DB
    } else {
        console.log("Database connected");
        // Enable foreign key constraints for data integrity
        global.db.run("PRAGMA foreign_keys=ON");
    }
});

// Add debugging middleware to log all requests
app.use((req, res, next) => {
    console.log(`${req.method} ${req.path} - Body:`, req.body);
    next();
});

// Home page route - Display main landing page
// Method: GET, Input: none, Output: renders home.ejs template
app.get('/', (req, res) => {
    res.render('home.ejs');
});

// Mount organiser routes - Handle all organiser-related functionality
// Input: routes from ./routes/organiser, Output: mounted at /organiser prefix
const organiserRoutes = require('./routes/organiser');
app.use('/organiser', organiserRoutes);

// Mount attendee routes - Handle all attendee-related functionality  
// Input: routes from ./routes/attendee, Output: mounted at /attendee prefix
const attendeeRoutes = require('./routes/attendee');
app.use('/attendee', attendeeRoutes);

// Catch-all route - Handle unmatched routes for debugging
// Method: ALL, Input: any unmatched URL, Output: 404 error with route info
app.use('*', (req, res) => {
    console.log(`Unmatched route: ${req.method} ${req.originalUrl}`);
    res.status(404).send(`Route not found: ${req.method} ${req.originalUrl}`);
});

// Start server - Listen for HTTP requests on specified port
app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
});