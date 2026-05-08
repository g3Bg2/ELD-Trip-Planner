# ELD Trip Planner

Full-stack app that takes a trip (current → pickup → dropoff) plus the driver's
current 70hr/8day cycle usage and outputs:

- A **route map** with rest, fuel and pickup/dropoff stops (OpenStreetMap +
  OSRM).
- **Daily log sheets** drawn to FMCSA layout, one per calendar day of the trip.
- A **trip timeline** of every duty status change.

## Stack

- **Backend**: Django 6, Django REST Framework, free OSM/OSRM APIs (no key).
- **Frontend**: React 19 (Vite) + Tailwind CSS + Leaflet.

## Quick start

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env             # then edit values
python manage.py migrate
python manage.py runserver 8000
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env             # set VITE_API_BASE_URL
npm run dev
```

Open <http://localhost:5173>.

## API

`POST /api/plan/` — body:

```json
{
  "current_location": "Chicago, IL",
  "pickup_location":  "Indianapolis, IN",
  "dropoff_location": "Atlanta, GA",
  "current_cycle_used_hours": 12
}
```

Response includes the geocoded points, full route geometry, every duty event,
mandatory stops, and per-day log segments ready to render.

## HOS rules implemented

Property-carrying driver, 70hr/8day, no adverse-driving exception:

- 11-hour driving limit per shift
- 14-hour on-duty window
- 30-minute break after 8 cumulative driving hours
- 70 on-duty hours in any 8-day rolling period (34-hour restart inserted
  if the cycle is exhausted)
- 10 consecutive hours off-duty (sleeper) between shifts
- 1 hour on-duty each for pickup and dropoff
- Fueling stop every ~1,000 miles (30 min on-duty)
- Average driving speed: 55 mph

## Deployment

### DigitalOcean droplet (Docker Compose)

The fastest path: a single `$6/mo` droplet running everything via
`docker compose`. The repo ships:

- `backend/Dockerfile` — Django + gunicorn on Python 3.13
- `frontend/Dockerfile` — multi-stage build, served by nginx (also reverse
  proxies `/api/` to the backend, so frontend & backend share an origin)
- `docker-compose.yml` — `db` (Postgres 16) + `backend` + `frontend`
- `.env.docker.example` — copy to `.env.docker` with your secrets

#### 1. Create the droplet

- DigitalOcean → Create → Droplets
- Image: **Marketplace → Docker on Ubuntu 22.04** (Docker pre-installed) or
  any Ubuntu 22.04/24.04 (then install Docker manually)
- Size: Basic / Regular / **2 GB RAM** is comfortable; 1 GB also works
- SSH key: add your public key
- Open ports `22`, `80`, `443` in the droplet's Firewall

#### 2. SSH in & clone

```bash
ssh root@<droplet-ip>

# If Docker isn't preinstalled:
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker

# Get the code
git clone https://github.com/<you>/<repo>.git eld
cd eld
```

#### 3. Configure & launch

```bash
cp .env.docker.example .env.docker
nano .env.docker         # fill in DJANGO_SECRET_KEY, POSTGRES_PASSWORD,
                         # DJANGO_ALLOWED_HOSTS=<your-ip-or-domain>, etc.

docker compose --env-file .env.docker up -d --build
docker compose --env-file .env.docker ps
```

Open `http://<droplet-ip>/` — the React app loads, `/api/` is proxied to
Django, Postgres holds saved trips.

#### 4. Updates

```bash
git pull
docker compose --env-file .env.docker up -d --build
```

#### 5. (Optional) HTTPS with a domain

Point a DNS A-record at the droplet IP, then run a Caddy or
nginx-proxy-manager container in front, or install certbot:

```bash
apt install -y certbot python3-certbot-nginx
# stop the frontend container, run certbot, then mount the certs into nginx
```

The simplest "just works" approach is to add a `caddy` service to
`docker-compose.yml` with `your-domain.com` configured — Caddy fetches
Let's Encrypt certs automatically.

---

### Backend on Render / Railway / Fly

The backend bundles `gunicorn`, `whitenoise`, `dj-database-url` and a
`build.sh`. Set environment variables from `.env.example`. On Render:

- Build command: `./build.sh`
- Start command: `gunicorn eld_backend.wsgi`
- Env: `DJANGO_DEBUG=False`, `DJANGO_ALLOWED_HOSTS=<your-host>`,
  `CORS_ALLOWED_ORIGINS=https://<your-frontend>.vercel.app`,
  `DJANGO_SECRET_KEY=…`, optionally `DATABASE_URL=postgres://…`.

### Frontend (Vercel)

- Framework preset: **Vite**
- Build command: `npm run build`
- Output directory: `dist`
- Env: `VITE_API_BASE_URL=https://<your-backend>/api`

Push to GitHub, import the repo into Vercel, and point the project root at
`frontend/`.

## Project layout

```
backend/                Django REST API
  trips/services/hos.py        HOS simulator
  trips/services/routing.py    Nominatim + OSRM helpers
  trips/views.py               POST /api/plan/, GET /api/trips/<id>/
frontend/               React + Vite client
  src/components/
    TripForm.jsx        inputs
    RouteMap.jsx        Leaflet map + markers
    DailyLogSheet.jsx   SVG daily log grid
    TripTimeline.jsx    duty event timeline
    StatTiles.jsx       summary stats
```
