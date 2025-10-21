# CM2040 Databases, Network and the Web

## For Windows Users
In the command prompt in the terminal
Run ```npm install``` from the project directory to install all the node packages
Run ```npm run build-db-win``` to create the database on Windows
Run ```npm run start``` to start serving the web app (Access via http://localhost:3000)

## For Mac or Linux Users
In the command prompt in the terminal
Run ```npm install``` from the project directory to install all the node packages
Run ```npm run build-db``` to create the database on Mac or Linux 
Run ```npm run start``` to start serving the web app (Access via http://localhost:3000)


## For easier access by examiner
Use the following credentials:

- **Mike Chen**: mike_coordinator_2025 
- **Sarah Johnson**: sarah_admin_2025

## Testing Routes
Navigate to the following URLs to test the application:

- http://localhost:3000
- http://localhost:3000/attendee
- http://localhost:3000/organiser

## Database Management

**For Windows users:**
In the command prompt in the terminal
Run ```npm run clean-db-win``` to delete the database on Windows before rebuilding it for a fresh start

**For Mac users:**
In the command prompt in the terminal
Run ```npm run clean-db``` to delete the database on Mac or Linux before rebuilding it for a fresh start

## Additional Libraries Utilised

1. **dotenv** (^16.5.0) - Loads environment variables from .env file into process.env
2. **express-session** (^1.18.1) - Session middleware for Express.js applications

## Extensions Implemented
Password access for organiser pages and routes


