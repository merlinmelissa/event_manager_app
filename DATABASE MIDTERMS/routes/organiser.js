/**
 * organiser.js
 * Routes for organiser functionality - creating, editing, publishing events and site settings
 */

const express = require("express");
const router = express.Router();

// Configuration: Set the organiser passwords 
const ORGANISER_PASSWORDS = {
    1: process.env.ORGANISER_PASSWORD_1,
    2: process.env.ORGANISER_PASSWORD_2
};

/**
 * Helper Function: Format date for database storage
 * Purpose: Converts datetime-local input format to database-compatible format
 * Input: dateString - Date in datetime-local format (YYYY-MM-DDTHH:MM) or database format
 * Output: Date string in database format (YYYY-MM-DD HH:MM:SS)
 * Used by: Event creation and editing functions
 */
function formatDateForDatabase(dateString) {
    // Return unchanged if no date provided
    if (!dateString) return dateString;
    
    // If already in correct database format, return as is
    if (dateString.includes(' ') && dateString.length === 19) {
        return dateString;
    }
    
    // Convert from datetime-local format (contains 'T' separator)
    if (dateString.includes('T')) {
        return dateString.replace('T', ' ') + ':00';
    }
    
    // Return unchanged if format not recognized
    return dateString;
}

/**
 * Helper Function: Format date for datetime-local HTML input
 * Purpose: Converts database date format to format expected by datetime-local inputs
 * Input: dateString - Date in database format (YYYY-MM-DD HH:MM:SS) or datetime-local format
 * Output: Date string in datetime-local format (YYYY-MM-DDTHH:MM)
 * Used by: Event editing forms to populate datetime inputs
 */
function formatDateForInput(dateString) {
    // Return empty string if no date provided
    if (!dateString) return '';
    
    // If already in datetime-local format, return as is
    if (dateString.includes('T') && dateString.length === 16) {
        return dateString;
    }
    
    // Convert from database format - remove seconds and replace space with T
    if (dateString.includes(' ')) {
        return dateString.substring(0, 16).replace(' ', 'T');
    }
    
    // Return unchanged if format not recognized
    return dateString;
}

/**
 * Middleware Function: Authentication requirement for organiser routes
 * Purpose: Protects admin routes by checking session authentication status
 * Input: req, res, next - Standard Express middleware parameters
 * Output: Calls next() if authenticated, redirects to login if not
 * Used by: All organiser routes except login and logout
 */
function requireAuth(req, res, next) {
    if (req.session && req.session.isAuthenticated && req.session.organiserId) {
        // User is authenticated, allow access to protected route
        next();
    } else {
        // User is not authenticated, redirect to login page
        res.redirect('/organiser/login');
    }
}

/**
 * @desc Display organiser login page with organiser selection
 * Method: GET
 * Endpoint: /organiser/login
 * Purpose: Shows login form for organiser authentication with organiser dropdown
 * Inputs: None
 * Outputs: Renders organiser-login.ejs template with organisers list
 */
router.get("/login", (req, res, next) => {
    // If already authenticated, redirect to organiser dashboard
    if (req.session && req.session.isAuthenticated) {
        return res.redirect('/organiser');
    }
    
    // Get all organisers for the dropdown
    const query = "SELECT organiser_id, name FROM organisers ORDER BY name";
    global.db.all(query, function (err, organisers) {
        if (err) {
            next(err);
        } else {
            // Render login form with organisers list and no error message initially
            res.render("organiser-login.ejs", { 
                error: null, 
                organisers: organisers || [] 
            });
        }
    });
});

/**
 * @desc Process organiser login form submission
 * Method: POST
 * Endpoint: /organiser/login
 * Purpose: Validates organiser password and creates authenticated session
 * Inputs:
 *   - req.body.password: Password submitted via login form
 *   - req.body.organiser_id: Selected organiser ID
 * Outputs: Redirects to organiser dashboard on success, or shows error on failure
 */
router.post("/login", (req, res, next) => {
    const { password, organiser_id } = req.body;
    
    // Get organiser details from database
    const query = "SELECT * FROM organisers WHERE organiser_id = ?";
    global.db.get(query, [organiser_id], function (err, organiser) {
        if (err) {
            next(err);
        } else if (!organiser) {
            // Organiser not found
            res.render("organiser-login.ejs", { 
                error: "Invalid organiser selected.",
                organisers: [] 
            });
        } else {
            // Password Validation: Check against configured organiser password
            const expectedPassword = ORGANISER_PASSWORDS[organiser_id];
            if (password === expectedPassword) {
                // Password is correct, create authenticated session
                req.session.isAuthenticated = true;
                req.session.organiserId = organiser.organiser_id;
                req.session.organiserName = organiser.name;
                console.log(`Organiser login successful: ${organiser.name}`);
                res.redirect('/organiser');
            } else {
                // Password is incorrect, show error message
                console.log(`Organiser login failed for ${organiser.name} - incorrect password`);
                // Re-fetch organisers for the dropdown
                const organisersQuery = "SELECT organiser_id, name FROM organisers ORDER BY name";
                global.db.all(organisersQuery, function (err, organisers) {
                    res.render("organiser-login.ejs", { 
                        error: "Incorrect password. Please try again.",
                        organisers: organisers || []
                    });
                });
            }
        }
    });
});

/**
 * @desc Process organiser logout
 * Method: POST
 * Endpoint: /organiser/logout
 * Purpose: Destroys authenticated session and logs out organiser
 * Inputs: None
 * Outputs: Redirects to home page after logout
 */
router.post("/logout", (req, res) => {
    // Destroy the session to log out the user
    req.session.destroy((err) => {
        if (err) {
            console.error("Error destroying session:", err);
        }
        // Redirect to home page regardless of session destruction result
        res.redirect('/');
    });
});

/**
 * @desc Display organiser dashboard with all events and statistics
 * Method: GET
 * Endpoint: /organiser/
 * Purpose: Shows main organiser interface with published and draft events
 * Inputs: 
 *   - req.query.updated: Optional query parameter indicating successful update
 * Outputs: Renders organiser-home.ejs with events and site settings
 */
router.get("/", requireAuth, (req, res, next) => {
    // Get current organiser details
    const organiserQuery = "SELECT * FROM organisers WHERE organiser_id = ?";
    global.db.get(organiserQuery, [req.session.organiserId], function (err, organiser) {
        if (err) {
            next(err);
        } else {
            // Database Query 1: Get site configuration settings
            const settingsQuery = "SELECT * FROM site_settings LIMIT 1";
            
            global.db.get(settingsQuery, function (err, settings) {
                if (err) {
                    next(err);
                } else {
                    // Database Query 2: Get published events with booking statistics
                    const publishedQuery = `
                        SELECT e.*, o.name as organiser_name,
                               COALESCE(SUM(b.full_price_tickets_booked), 0) as full_booked,
                               COALESCE(SUM(b.concession_tickets_booked), 0) as concession_booked
                        FROM events e 
                        LEFT JOIN organisers o ON e.organiser_id = o.organiser_id
                        LEFT JOIN bookings b ON e.event_id = b.event_id 
                        WHERE e.status = 'published' 
                        GROUP BY e.event_id 
                        ORDER BY e.event_date ASC
                    `;
                    
                    global.db.all(publishedQuery, function (err, publishedEvents) {
                        if (err) {
                            next(err);
                        } else {
                            // Database Query 3: Get draft events for editing
                            const draftQuery = `
                                SELECT e.*, o.name as organiser_name 
                                FROM events e 
                                LEFT JOIN organisers o ON e.organiser_id = o.organiser_id
                                WHERE e.status = 'draft' 
                                ORDER BY e.created_date DESC
                            `;
                            
                            global.db.all(draftQuery, function (err, draftEvents) {
                                if (err) {
                                    next(err);
                                } else {
                                    // Success Message Handling
                                    const successMessage = req.query.updated ? 'Event updated successfully!' : null;
                                    
                                    // Render organiser dashboard with all retrieved data
                                    res.render("organiser-home.ejs", {
                                        currentOrganiser: organiser,
                                        settings: settings || {
                                            site_name: 'Event Manager', 
                                            site_description: 'Manage your events'
                                        },
                                        publishedEvents: publishedEvents,
                                        draftEvents: draftEvents,
                                        successMessage: successMessage
                                    });
                                }
                            });
                        }
                    });
                }
            });
        }
    });
});

/**
 * @desc Display site settings configuration page
 * Method: GET
 * Endpoint: /organiser/settings
 * Purpose: Shows form for editing site-wide settings (name, description)
 * Inputs: None
 * Outputs: Renders site-settings.ejs template with current settings
 */
router.get("/settings", requireAuth, (req, res, next) => {
    // Database Query: Get current site settings
    const query = "SELECT * FROM site_settings LIMIT 1";
    
    global.db.get(query, function (err, settings) {
        if (err) {
            next(err);
        } else {
            // Render settings form with current values or empty defaults
            res.render("site-settings.ejs", {
                settings: settings || {site_name: '', site_description: ''}
            });
        }
    });
});

/**
 * @desc Process site settings update form submission
 * Method: POST
 * Endpoint: /organiser/settings
 * Purpose: Updates site-wide configuration settings
 * Inputs:
 *   - req.body.site_name: New site name
 *   - req.body.site_description: New site description
 * Outputs: Redirects to organiser dashboard on success, or error message on failure
 */
router.post("/settings", requireAuth, (req, res, next) => {
    const { site_name, site_description } = req.body;
    
    // Input Validation: Ensure both required fields are provided
    if (!site_name || !site_description) {
        return res.status(400).send("All fields are required");
    }
    
    // Database Query: Insert or update site settings (upsert operation)
    const query = `
        INSERT OR REPLACE INTO site_settings (setting_id, site_name, site_description) 
        VALUES (1, ?, ?)
    `;
    const params = [site_name, site_description];
    
    global.db.run(query, params, function (err) {
        if (err) {
            next(err);
        } else {
            // Redirect to organiser dashboard after successful update
            res.redirect("/organiser");
        }
    });
});

/**
 * @desc Display create new event form (blank form)
 * Method: GET
 * Endpoint: /organiser/create-event
 * Purpose: Shows empty form for creating a new event
 * Inputs: None
 * Outputs: Renders edit-event.ejs template with blank event object
 */
router.get("/create-event", requireAuth, (req, res) => {
    // Create blank event object with default values for form
    const blankEvent = {
        title: '',
        description: '',
        event_date: '',
        full_price_tickets: 0,
        full_price_cost: 0.00,
        concession_tickets: 0,
        concession_cost: 0.00
    };
    
    // Render event creation form with blank template
    res.render("edit-event.ejs", { event: blankEvent });
});

/**
 * @desc Process new event creation form submission
 * Method: POST
 * Endpoint: /organiser/create-event
 * Purpose: Creates a new event in draft status from form data
 * Inputs: Event details from form
 * Outputs: Redirects to organiser dashboard on success, or error message on failure
 */
router.post("/create-event", requireAuth, (req, res, next) => {
    const { title, description, event_date, full_price_tickets, full_price_cost, concession_tickets, concession_cost } = req.body;
    
    // Input Validation: Check required fields are provided
    if (!title || !description || !event_date) {
        return res.status(400).send("Title, description, and event date are required");
    }
    
    // Date Formatting: Convert form date to database format
    const formattedDate = formatDateForDatabase(event_date);
    
    // Database Query: Insert new event record in draft status with organiser_id
    const query = `
        INSERT INTO events (title, description, event_date, full_price_tickets, full_price_cost, concession_tickets, concession_cost, status, organiser_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?)
    `;
    const params = [
        title, 
        description, 
        formattedDate, 
        full_price_tickets || 0, 
        full_price_cost || 0.00, 
        concession_tickets || 0, 
        concession_cost || 0.00,
        req.session.organiserId
    ];
    
    global.db.run(query, params, function (err) {
        if (err) {
            next(err);
        } else {
            // Redirect to organiser dashboard after successful creation
            res.redirect("/organiser");
        }
    });
});

/**
 * @desc Display edit event form for specific event
 * Method: GET
 * Endpoint: /organiser/edit-event/:id
 * Purpose: Shows form pre-populated with existing event data for editing
 * Inputs: req.params.id: Event ID from URL parameter
 * Outputs: Renders edit-event.ejs template with event data, or 404 if not found
 */
router.get("/edit-event/:id", requireAuth, (req, res, next) => {
    const eventId = req.params.id;
    
    // Database Query: Get event details for editing
    const query = "SELECT * FROM events WHERE event_id = ?";
    
    global.db.get(query, [eventId], function (err, event) {
        if (err) {
            next(err);
        } else if (!event) {
            res.status(404).send("Event not found");
        } else {
            // Date Formatting: Convert database date format for datetime-local input
            if (event.event_date) {
                event.event_date = formatDateForInput(event.event_date);
            }
            
            // Render edit form with existing event data
            res.render("edit-event.ejs", { event: event });
        }
    });
});

/**
 * @desc Process event update form submission
 * Method: POST
 * Endpoint: /organiser/edit-event/:id
 * Purpose: Updates existing event with new information from form
 * Inputs: req.params.id and event details from form
 * Outputs: Redirects to organiser dashboard with success message, or error on failure
 */
router.post("/edit-event/:id", requireAuth, (req, res, next) => {
    const eventId = req.params.id;
    const { title, description, event_date, full_price_tickets, full_price_cost, concession_tickets, concession_cost } = req.body;
    
    // Input Validation: Check required fields are provided
    if (!title || !description || !event_date) {
        return res.status(400).send("Title, description, and event date are required");
    }
    
    // Date Formatting: Convert form date to database format
    const formattedDate = formatDateForDatabase(event_date);
    
    // Database Query: Update existing event record
    const query = `
        UPDATE events 
        SET title = ?, description = ?, event_date = ?, full_price_tickets = ?, full_price_cost = ?, 
            concession_tickets = ?, concession_cost = ?, last_modified = CURRENT_TIMESTAMP 
        WHERE event_id = ?
    `;
    const params = [
        title, 
        description, 
        formattedDate, 
        full_price_tickets || 0, 
        full_price_cost || 0.00, 
        concession_tickets || 0, 
        concession_cost || 0.00, 
        eventId
    ];
    
    global.db.run(query, params, function (err) {
        if (err) {
            next(err);
        } else {
            // Redirect to organiser dashboard with success indicator
            res.redirect("/organiser?updated=true");
        }
    });
});

/**
 * @desc Publish a draft event (make it available for booking)
 * Method: POST
 * Endpoint: /organiser/publish-event/:id
 * Purpose: Changes event status from draft to published
 * Inputs: req.params.id: Event ID from URL parameter
 * Outputs: Redirects to organiser dashboard, or error on failure
 */
router.post("/publish-event/:id", requireAuth, (req, res, next) => {
    const eventId = req.params.id;
    
    // Database Query: Update event status to published
    const query = `
        UPDATE events 
        SET status = 'published', published_date = CURRENT_TIMESTAMP 
        WHERE event_id = ? AND status = 'draft'
    `;
    
    global.db.run(query, [eventId], function (err) {
        if (err) {
            next(err);
        } else {
            // Redirect to organiser dashboard after successful publish
            res.redirect("/organiser");
        }
    });
});

/**
 * @desc Delete an event permanently
 * Method: POST
 * Endpoint: /organiser/delete-event/:id
 * Purpose: Removes event from database
 * Inputs: req.params.id: Event ID from URL parameter
 * Outputs: Redirects to organiser dashboard, or error on failure
 */
router.post("/delete-event/:id", requireAuth, (req, res, next) => {
    const eventId = req.params.id;
    
    // Database Query: Delete event record
    const query = "DELETE FROM events WHERE event_id = ?";
    
    global.db.run(query, [eventId], function (err) {
        if (err) {
            next(err);
        } else {
            // Redirect to organiser dashboard after successful deletion
            res.redirect("/organiser");
        }
    });
});

// Module initialization log
console.log("Organiser routes loaded successfully");

// Export router for use in main application
module.exports = router;