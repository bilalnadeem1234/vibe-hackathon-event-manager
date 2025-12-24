from flask import (
    Flask, jsonify, request, render_template, abort, redirect, url_for, session
)
from jinja2 import TemplateNotFound
import json
import threading
from tempfile import NamedTemporaryFile
import shutil
from pathlib import Path
import os

app = Flask(
    __name__,
    template_folder="templates",
    static_folder="static",
    static_url_path="/static"
)

# Development secret; replace in production
app.secret_key = os.environ.get("FLASK_SECRET", "dev-secret-change-me")

# optional CORS for frontend development
try:
    from flask_cors import CORS
    CORS(app)
except Exception:
    pass

BASE_DIR = Path(__file__).resolve().parent

USERS_LOCK = threading.Lock()
EVENTS_LOCK = threading.Lock()


# --- Helper Functions ---

def read_json(path, default=[]):
    if not os.path.exists(path):
        return default
    try:
        with open(path, 'r') as f:
            return json.load(f)
    except:
        return default


def write_json_atomic(path, data):
    with open(path, 'w') as f:
        json.dump(data, f, indent=4)


def ensure_json_file(path, default_data):
    if not os.path.exists(path):
        write_json_atomic(path, default_data)
        print(f"Created file: {path}")


# define admins file path (must exist before ensure_json_file is called)
ADMINS_PATH = BASE_DIR / "admins.json"
EVENTS_PATH = BASE_DIR / "events.json"
USERS_PATH = BASE_DIR / "users.json"
ensure_json_file(str(ADMINS_PATH), [{"username": "admin", "password": "admin123", "role": "admin"}])


# Add admin secrets file path and ensure it exists with a default secret
ADMIN_SECRETS_PATH = BASE_DIR / "admin_secrets.json"
ensure_json_file(str(EVENTS_PATH), [])
ensure_json_file(str(USERS_PATH), [])
ensure_json_file(str(ADMIN_SECRETS_PATH), {"admin_user": "superadmin", "admin_pass": "NTU_Admin_Secure_2025"})
# Attendance storage (per-user list of event ids marked as "going")
ATTENDANCE_PATH = BASE_DIR / "attendance.json"
ensure_json_file(str(ATTENDANCE_PATH), {})


# ---------- Template Routes ----------
@app.route("/", methods=["GET"])
def index():
    # allow index to optionally show unauthorized message via query param
    unauthorized = request.args.get("unauthorized")
    try:
        return render_template("index.html", unauthorized=bool(unauthorized))
    except TemplateNotFound:
        return jsonify({"success": False, "message": "Template 'index.html' not found in templates/"}), 404


@app.route("/index.html", methods=["GET"])
def index_html():
    return index()


@app.route("/register", methods=["GET"])
def register_page():
    try:
        # note: your file in templates is registration.html — render that file
        return render_template("registration.html")
    except TemplateNotFound:
        return jsonify({"success": False, "message": "Template 'registration.html' not found in templates/"}), 404





# --- 1. Admin Login Page dikhane ke liye ---
@app.route("/admin_login", methods=["GET"])
def admin_login_page():
    # Check karein ke user pehle se admin to nahi?
    if session.get("role") == "admin":
        return redirect(url_for("admin_dashboard"))
    return render_template("admin_login.html")

# --- 2. Admin Verification (The Brain) ---
@app.route("/api/admin_login", methods=["POST"])
def api_admin_login():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""

    # Yahan ADMINS_PATH hi use karein
    admins = read_json(ADMINS_PATH, [])
    matched_admin = next((a for a in admins if a.get("username") == username), None)

    if not matched_admin:
        # Student check logic (Bohat acha logic hai aapka)
        users = read_json(USERS_PATH, [])
        if any(u.get("username") == username for u in users):
            return jsonify({"success": False, "message": "Access Denied: Not an Admin Account"}), 403
        return jsonify({"success": False, "message": "Invalid Admin Credentials"}), 401

    if matched_admin.get("password") != password:
        return jsonify({"success": False, "message": "Wrong password"}), 401

    # Session set karna
    session["username"] = username
    session["role"] = "admin"
    return jsonify({"success": True, "redirect": "/admin_dashboard"}), 200

# --- 3. Dashboard Security ---
@app.route("/admin_dashboard", methods=["GET"])
def admin_dashboard():
    if session.get("role") != "admin":
        # Sirf redirect karein, session.clear() karne se student login bhi urr jayega
        return redirect(url_for("admin_login_page"))
    return render_template("admin_dashboard.html", user=session.get("username"))


@app.route("/dashboard", methods=["GET"])
def dashboard():
    # require a logged-in user via session
    if not session.get("username"):
        return redirect(url_for("index") + "?unauthorized=1")
    try:
        return render_template("dashboard.html", user=session.get("username"))
    except TemplateNotFound:
        return jsonify({"success": False, "message": "Template 'dashboard.html' not found in templates/"}), 404


# ---------- API Endpoints ----------
@app.route("/api/events", methods=["GET"])
def api_get_events():
    events = read_json(EVENTS_PATH, [])
    return jsonify(events), 200


@app.route("/api/events", methods=["POST"])
def api_save_events():
    data = request.get_json(silent=True)
    if not isinstance(data, list):
        return jsonify({"success": False, "message": "Provide a JSON array of events"}), 400
    try:
        write_json_atomic(EVENTS_PATH, data)
    except Exception as e:
        app.logger.error(f"Failed to write events.json: {e}")
        return jsonify({"success": False, "message": "Failed to save events"}), 500
    return jsonify({"success": True, "message": "Events updated"}), 200


@app.route("/api/add_event", methods=["POST"])
def api_add_event():
    # Accept JSON payload or form data
    data = request.get_json(silent=True) or request.form or {}
    title = (data.get("title") or "").strip()
    date = (data.get("date") or "").strip()
    category = (data.get("category") or "").strip()
    image_url = (data.get("image_url") or data.get("image") or "").strip()
    description = (data.get("description") or "").strip()

    if not title or not date or not category:
        return jsonify({"success": False, "message": "title, date and category are required"}), 400

    with EVENTS_LOCK:
        events_list = read_json(EVENTS_PATH, [])
        try:
            next_id = max((int(e.get("id", 0)) for e in events_list), default=0) + 1
        except Exception:
            next_id = len(events_list) + 1

        new_event = {
            "id": next_id,
            "title": title,
            "description": description,
            "date": date,
            "category": category,
            "organizer": session.get("username", "Admin"),
            "image_url": image_url
        }
        events_list.append(new_event)
        try:
            write_json_atomic(EVENTS_PATH, events_list)
        except Exception as e:
            app.logger.error(f"Failed to write events.json: {e}")
            return jsonify({"success": False, "message": "Failed to save event"}), 500

    return jsonify({"success": True, "message": "Event added", "event": new_event}), 201


@app.route("/api/register", methods=["POST"])
def api_register():
    """
    Student registration:
    - Reserved username 'admin' blocked.
    - Always assign role 'user'.
    """
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""

    if not username or not password:
        return jsonify({"success": False, "message": "Username and password required"}), 400

    if username.lower() == "admin":
        return jsonify({"success": False, "message": "Username 'admin' is reserved for admin portal"}), 400

    role = "user"

    with USERS_LOCK:
        users = read_json(USERS_PATH, [])
        if any(u.get("username") == username for u in users):
            return jsonify({"success": False, "message": "Username already exists"}), 400

        users.append({"username": username, "password": password, "role": role})
        try:
            write_json_atomic(USERS_PATH, users)
        except Exception as e:
            app.logger.error(f"Failed to write users.json: {e}")
            return jsonify({"success": False, "message": "Failed to save user"}), 500

    return jsonify({"success": True, "message": "Registered", "role": role}), 201


@app.route("/api/login", methods=["POST"])
def api_login():
    """
    Student login only against users.json.
    No admin fallback here. On success set session and return role + redirect.
    """
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""

    if not username or not password:
        return jsonify({"success": False, "message": "Username and password required"}), 400

    users = read_json(USERS_PATH, [])
    matched = next((u for u in users if u.get("username") == username and u.get("password") == password), None)

    if matched:
        role = matched.get("role", "user")
        session["username"] = username
        session["role"] = role
        session["is_admin"] = (role == "admin")
        if role == "admin":
            return jsonify({"success": True, "role": "admin", "redirect": "/admin_dashboard"}), 200
        return jsonify({"success": True, "role": "user", "redirect": "/dashboard"}), 200

    return jsonify({"success": False, "message": "Wrong password"}), 401


@app.route("/api/logout", methods=["POST"])
def api_logout():
    """
    Clear session keys including is_admin.
    """
    session.pop("username", None)
    session.pop("role", None)
    session.pop("is_admin", None)
    return jsonify({"success": True, "message": "Logged out"}), 200


# ---------- Attendance (Going) API ----------
@app.route('/api/attendance', methods=['GET'])
def api_get_attendance():
    username = session.get('username')
    if not username:
        return jsonify({"success": False, "message": "Authentication required"}), 401
    data = read_json(str(ATTENDANCE_PATH), {})
    return jsonify(data.get(username, [])), 200


@app.route('/api/attendance', methods=['POST'])
def api_update_attendance():
    username = session.get('username')
    if not username:
        return jsonify({"success": False, "message": "Authentication required"}), 401
    body = request.get_json(silent=True) or {}
    event_id = body.get('event_id')
    going = bool(body.get('going', True))
    if event_id is None:
        return jsonify({"success": False, "message": "event_id required"}), 400

    try:
        eid = int(event_id)
    except Exception:
        return jsonify({"success": False, "message": "invalid event_id"}), 400

    with USERS_LOCK:
        attendance = read_json(str(ATTENDANCE_PATH), {})
        user_list = set(attendance.get(username, []))
        if going:
            user_list.add(eid)
        else:
            user_list.discard(eid)
        attendance[username] = sorted(list(user_list))
        try:
            write_json_atomic(str(ATTENDANCE_PATH), attendance)
        except Exception as e:
            app.logger.error(f"Failed to write attendance.json: {e}")
            return jsonify({"success": False, "message": "Failed to update attendance"}), 500

    return jsonify({"success": True, "events": attendance[username]}), 200


# ---------- Error handlers ----------
@app.errorhandler(404)
def not_found(e):
    # return JSON for API calls; otherwise a short HTML message
    if request.path.startswith("/api/"):
        return jsonify({"success": False, "message": "Not found"}), 404
    return (
        "<h3>Not Found</h3><p>The requested resource was not found on the server.</p>",
        404,
    )


@app.errorhandler(500)
def server_error(e):
    return jsonify({"success": False, "message": "Internal server error"}), 500


if __name__ == "__main__":
    # ensure storage files exist when starting
    ensure_json_file(str(EVENTS_PATH), [])
    ensure_json_file(str(USERS_PATH), [])
    ensure_json_file(str(ADMINS_PATH), [{"username": "admin", "password": "admin123", "role": "admin"}])
    ensure_json_file(str(ADMIN_SECRETS_PATH), {"admin_user": "superadmin", "admin_pass": "NTU_Admin_Secure_2025"})
    app.run(host="0.0.0.0", port=5000, debug=True)