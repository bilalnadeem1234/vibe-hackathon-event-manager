
VIBE Hackathon Project

A lightweight Flask-based event management system built as a hackathon prototype.
It supports event creation, participant registration, and attendance tracking using a JSON-based datastore.

--------------------------------------------------
WHY THIS PROJECT?
--------------------------------------------------
This project demonstrates:
- Rapid prototyping using Flask
- Clean separation of backend, frontend, and data
- Practical event management workflow
- Simple setup without a database

--------------------------------------------------
FEATURES
--------------------------------------------------
- Admin authentication and dashboard
- Event management
- Public user registration
- Attendance tracking
- JSON-based data storage
- Organized static assets and templates

--------------------------------------------------
TECH STACK
--------------------------------------------------
Backend     : Python, Flask
Frontend    : HTML, CSS, JavaScript
Storage     : JSON files
Environment : Localhost

--------------------------------------------------
PROJECT STRUCTURE
--------------------------------------------------
VIBE-Hackathon-Project/
|
|-- app.py                  -> Flask app entry point
|
|-- templates/              -> HTML templates
|   |-- index.html
|   |-- registration.html
|   |-- admin_dashboard.html
|   |-- user_dashboard.html
|
|-- static/                 -> CSS & JavaScript
|   |-- css/
|   |-- js/
|       |-- events.js
|
|-- images/                 -> Project images
|
|-- admins.json             -> Admin accounts
|-- admin_secrets.json      -> Admin secrets
|-- users.json              -> Registered users
|-- events.json             -> Events data
|-- attendance.json         -> Attendance records
|
|-- README.txt

--------------------------------------------------
REQUIREMENTS
--------------------------------------------------
- Python 3.8 or higher
- Flask

Install Flask:
pip install Flask

--------------------------------------------------
QUICK START (WINDOWS)
--------------------------------------------------
1. Create virtual environment:
python -m venv .venv

Activate:
PowerShell:
.\.venv\Scripts\Activate.ps1

CMD:
.\.venv\Scripts\activate.bat

2. Run the app:
python app.py

OR using Flask CLI:
set FLASK_APP=app.py
flask run

Open in browser:
http://127.0.0.1:5000/

--------------------------------------------------
DATA STORAGE
--------------------------------------------------
This project uses local JSON files as datastore:
- users.json       -> User registrations
- events.json      -> Event information
- attendance.json  -> Attendance records
- admins.json      -> Admin accounts
- admin_secrets.json -> Admin credentials

Always back up JSON files before editing.

--------------------------------------------------
LIMITATIONS
--------------------------------------------------
- No production-level security
- No database integration
- Intended for demo and learning purposes only

--------------------------------------------------
FUTURE ENHANCEMENTS
--------------------------------------------------
- Database integration (MySQL / PostgreSQL)
- Secure authentication system
- Role-based access control
- Cloud deployment

--------------------------------------------------
LICENSE
--------------------------------------------------
No license included yet.

--------------------------------------------------
SUPPORT
--------------------------------------------------
If you find this project useful, give it a star on GitHub.
