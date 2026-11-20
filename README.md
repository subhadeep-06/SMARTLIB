# SMARTLIB — Enterprise Smart Library Management & Automation System

> *"Transforming Traditional Libraries into Intelligent Digital Ecosystems."*

## Overview
SMARTLIB is a multi-branch university & institutional library management platform combining enterprise circulation, separated `Book` / `BookCopy` physical asset tracking, FIFO reservations, role-based access control (Super Admin, Branch Admin, Librarian, Faculty, Student), and 13 intelligent library automation modules.

## Architecture & Repository Layout
- **`backend/`** — Java 21, Spring Boot 3.4, Spring Security 6 (JWT + BCrypt + `BranchScopeGuard`), Spring Data MongoDB (`MongoRepository`, `MongoTemplate`, `MongoTransactionManager`), OpenAPI/Swagger, Spring Scheduling, ZXing QR, JUnit 5 + Mockito, and multi-stage `Dockerfile` for **Render**.
- **`src/` & `server.ts`** — React + Vite (**JavaScript** `.js`/`.jsx`), Tailwind CSS, React Router, Axios, Recharts, Lucide React, plus an Express REST API runtime for interactive local/preview execution on port 3000 with persistent document storage and `node:test` domain verification.
- **`docs/ARCHITECTURE.md`** — Complete Phase 1 system architecture, 32-collection MongoDB Atlas schema & index plan, RBAC matrix, and concurrency design.
- **`vercel.json`** — SPA client-side route rewrites for **Vercel** deployment.
- **`docker-compose.yml` & `.github/workflows/ci.yml`** — Container orchestration and CI verification pipelines.

## Demo Institutional Accounts (Password: `SmartLib@2026`)
| Role | Email | Branch Scope |
|---|---|---|
| Super Admin | `director@smartlib.edu` | Organization-Wide |
| Branch Admin | `meera.nair@smartlib.edu` | Central Heritage Library (`MAIN-01`) |
| Librarian | `rajesh.verma@smartlib.edu` | Central Heritage Library (`MAIN-01`) |
| Faculty | `prof.alvarez@smartlib.edu` | Central Heritage Library (`MAIN-01`) |
| Student | `ananya.sharma@smartlib.edu` | Central Heritage Library (`MAIN-01`) |

## Local Development
```bash
npm install
npm test        # Runs pure domain business logic tests
npm run dev     # Launches full-stack server + React Vite SPA on http://localhost:3000
npm run build   # Production frontend build -> dist/
```

## Spring Boot Backend (Java 21 + MongoDB Atlas)
```bash
cd backend
export MONGODB_URI="mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/smartlib?retryWrites=true&w=majority"
export JWT_SECRET="<256-bit-secret>"
mvn test
mvn spring-boot:run
```

## Production Deployment
1. **MongoDB Atlas**: Provision a replica-set cluster (M0/M10+), create database `smartlib`, whitelist Render outbound IPs, and set `MONGODB_URI`.
2. **Render (Backend)**: Create a Docker Web Service pointing to `backend/Dockerfile`, set `MONGODB_URI`, `MONGODB_DATABASE`, `JWT_SECRET`, `FRONTEND_URL`, and health check path `/actuator/health`.
3. **Vercel (Frontend)**: Connect GitHub repository, set build command `npm run build`, output directory `dist`, and environment variable `VITE_API_BASE_URL=https://<your-render-service>.onrender.com/api`.
