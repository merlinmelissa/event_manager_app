/**
 * attendee.js
 * Routes for attendee functionality - viewing and booking events
 */

const express = require("express");
const router = express.Router();

/**
 * @desc Display attendee home page with published events
 * Method: GET
 * Endpoint: /attendee/
 * Purpose: Shows the main landing page for attendees with all available published events
 * Inputs: None (no parameters required)
 * Outputs: Renders attendee-home.ejs template with site settings and events data
 */
router.get("/", (req, res, next) => {
    console.log("Attendee home route accessed");
    
    // Database Query 1: Retrieve site configuration settings
    // Purpose: Get site branding information (name, description) for page display
    // Input: None (gets first/only row from site_settings table)
    // Output: Single settings object or null if no settings exist
    const settingsQuery = "SELECT * FROM site_settings LIMIT 1";
    
    global.db.get(settingsQuery, function (err, settings) {
        if (err) {
            console.error("Settings query error:", err);
            next(err); // Pass error to Express error handler
        } else {
            // Database Query 2: Retrieve all published events with booking statistics
            // Purpose: Get all events available for booking with current booking counts
            // Input: None (filters for published status only)
            // Output: Array of event objects with booking totals
            const eventsQuery = `
                SELECT e.*, 
                       COALESCE(SUM(b.full_price_tickets_booked), 0) as full_booked,
                       COALESCE(SUM(b.concession_tickets_booked), 0) as concession_booked
                FROM events e 
                LEFT JOIN bookings b ON e.event_id = b.event_id 
                WHERE e.status = 'published' 
                GROUP BY e.event_id 
                ORDER BY e.event_date ASC
            `;
            
            global.db.all(eventsQuery, function (err, events) {
                if (err) {
                    console.error("Events query error:", err);
                    next(err); // Pass error to Express error handler
                } else {
                    console.log("Found", events.length, "published events");
                    
                    // Render the attendee home page with retrieved data
                    // Provides fallback values if settings don't exist
                    res.render("attendee-home.ejs", {
                        settings: settings || {
                            site_name: 'Event Manager', 
                            site_description: 'Book your events'
                        },
                        events: events
                    });
                }
            });
        }
    });
});

/**
 * @desc Display individual event details page for booking
 * Method: GET
 * Endpoint: /attendee/event/:id
 * Purpose: Shows detailed information about a specific event and provides booking interface
 * Inputs: req.params.id: Event ID from URL parameter
 * Outputs: Renders attendee-event.ejs template with event details and availability
 */
router.get("/event/:id", (req, res, next) => {
    const eventId = req.params.id;
    console.log("Event detail route accessed for event ID:", eventId);
    
    // Database Query: Get specific event details with current booking totals
    // Purpose: Retrieve event information and calculate ticket availability
    // Input: Event ID from URL parameter
    // Output: Single event object with booking statistics or null if not found
    const eventQuery = `
        SELECT e.*, 
               COALESCE(SUM(b.full_price_tickets_booked), 0) as full_booked,
               COALESCE(SUM(b.concession_tickets_booked), 0) as concession_booked
        FROM events e 
        LEFT JOIN bookings b ON e.event_id = b.event_id 
        WHERE e.event_id = ? AND e.status = 'published'
        GROUP BY e.event_id
    `;
    
    global.db.get(eventQuery, [eventId], function (err, event) {
        if (err) {
            console.error("Event query error:", err);
            next(err); // Pass error to Express error handler
        } else if (!event) {
            console.log("Event not found or not published:", eventId);
            res.status(404).send("Event not found or not published");
        } else {
            console.log("Event found:", event.title);
            
            // Calculate available tickets for booking interface
            // Purpose: Determine how many tickets are still available for purchase
            event.full_available = event.full_price_tickets - event.full_booked;
            event.concession_available = event.concession_tickets - event.concession_booked;
            
            // Render event detail page with calculated availability
            res.render("attendee-event.ejs", { event: event });
        }
    });
});

/**
 * @desc Process booking form submission for an event
 * Method: POST
 * Endpoint: /attendee/book/:id
 * Purpose: Handles the booking process including validation, availability checking, and booking creation
 * Inputs:
 *   - req.params.id: Event ID from URL parameter
 *   - req.body.attendee_name: Name of person making booking
 *   - req.body.full_price_tickets: Number of full-price tickets requested
 *   - req.body.concession_tickets: Number of concession tickets requested
 * Outputs: Renders booking-confirmation.ejs on success, or error message on failure
 */
router.post("/book/:id", (req, res, next) => {
    const eventId = req.params.id;
    console.log("Booking route accessed for event ID:", eventId);
    console.log("Request body:", req.body);
    
    // Extract and validate form data
    const { attendee_name, full_price_tickets, concession_tickets } = req.body;
    
    // Input Validation 1: Check attendee name is provided
    // Purpose: Ensure booking has a valid attendee name
    if (!attendee_name || attendee_name.trim() === '') {
        console.log("Validation failed: missing attendee name");
        return res.status(400).send("Attendee name is required");
    }
    
    // Input Validation 2: Parse and validate ticket quantities
    // Purpose: Convert string inputs to numbers and handle invalid values
    const fullWanted = parseInt(full_price_tickets) || 0;
    const concessionWanted = parseInt(concession_tickets) || 0;
    
    console.log("Tickets requested - Full:", fullWanted, "Concession:", concessionWanted);
    
    // Input Validation 3: Ensure at least one ticket is selected
    // Purpose: Prevent bookings with zero tickets
    if (fullWanted + concessionWanted === 0) {
        console.log("Validation failed: no tickets selected");
        return res.status(400).send("Please select at least one ticket");
    }
    
    // Database Query: Get current event status and booking totals for availability check
    // Purpose: Verify event exists, is published, and check current ticket availability
    // Input: Event ID from URL parameter
    // Output: Event object with current booking totals or null if not found
    const checkQuery = `
        SELECT e.*, 
               COALESCE(SUM(b.full_price_tickets_booked), 0) as full_booked,
               COALESCE(SUM(b.concession_tickets_booked), 0) as concession_booked
        FROM events e 
        LEFT JOIN bookings b ON e.event_id = b.event_id 
        WHERE e.event_id = ? AND e.status = 'published'
        GROUP BY e.event_id
    `;
    
    global.db.get(checkQuery, [eventId], function (err, event) {
        if (err) {
            console.error("Event check query error:", err);
            next(err); // Pass error to Express error handler
        } else if (!event) {
            console.log("Event not found during booking:", eventId);
            res.status(404).send("Event not found");
        } else {
            console.log("Event found for booking:", event.title);
            
            // Availability Check: Calculate remaining tickets for each type
            // Purpose: Ensure sufficient tickets are available before creating booking
            const fullAvailable = event.full_price_tickets - event.full_booked;
            const concessionAvailable = event.concession_tickets - event.concession_booked;
            
            console.log("Tickets available - Full:", fullAvailable, "Concession:", concessionAvailable);
            
            // Availability Validation: Check if requested tickets are available
            // Purpose: Prevent overbooking by validating against current availability
            if (fullWanted > fullAvailable || concessionWanted > concessionAvailable) {
                console.log("Not enough tickets available");
                return res.status(400).send("Not enough tickets available");
            }
            
            // Cost Calculation: Calculate total booking cost
            // Purpose: Determine total amount for booking based on ticket types and quantities
            const totalCost = (fullWanted * event.full_price_cost) + (concessionWanted * event.concession_cost);
            console.log("Total cost calculated:", totalCost);
            
            // Database Query: Insert new booking record
            // Purpose: Create the booking record in the database
            // Input: Event ID, attendee name, ticket quantities, and total cost
            // Output: New booking ID (available as this.lastID)
            const bookingQuery = `
                INSERT INTO bookings (event_id, attendee_name, full_price_tickets_booked, concession_tickets_booked, total_cost) 
                VALUES (?, ?, ?, ?, ?)
            `;
            const bookingParams = [eventId, attendee_name.trim(), fullWanted, concessionWanted, totalCost];
            
            global.db.run(bookingQuery, bookingParams, function (err) {
                if (err) {
                    console.error("Booking insert error:", err);
                    next(err); // Pass error to Express error handler
                } else {
                    console.log("Booking successful, ID:", this.lastID);
                    
                    // Render booking confirmation page with booking details
                    // Purpose: Show confirmation of successful booking to user
                    res.render("booking-confirmation.ejs", {
                        event: event,
                        booking: {
                            attendee_name: attendee_name.trim(),
                            full_price_tickets_booked: fullWanted,
                            concession_tickets_booked: concessionWanted,
                            total_cost: totalCost
                        }
                    });
                }
            });
        }
    });
});

// Module initialization log
console.log("Attendee routes loaded successfully");

// Export router for use in main application
module.exports = router;