const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../database/database");

const router = express.Router();

const JWT_SECRET =
    process.env.JWT_SECRET ||
    "coalguard-development-secret";


/* =========================================================
   LOGIN
   POST /api/auth/login
========================================================= */

router.post("/login", async (req, res) => {

    try {

        const {
            email,
            password
        } = req.body;


        /* -------------------------------------------------
           VALIDATION
        ------------------------------------------------- */

        if (!email || !password) {

            return res.status(400).json({
                success: false,
                message:
                    "Email and password are required."
            });

        }


        /* -------------------------------------------------
           FIND USER
        ------------------------------------------------- */

        const user = db.prepare(`
            SELECT
                id,
                name,
                email,
                password,
                role
            FROM users
            WHERE LOWER(email) = LOWER(?)
        `).get(
            email.trim()
        );


        if (!user) {

            return res.status(401).json({
                success: false,
                message:
                    "Invalid email or password."
            });

        }


        /* -------------------------------------------------
           CHECK PASSWORD
        ------------------------------------------------- */

        const passwordMatches =
            await bcrypt.compare(
                password,
                user.password
            );


        if (!passwordMatches) {

            return res.status(401).json({
                success: false,
                message:
                    "Invalid email or password."
            });

        }


        /* -------------------------------------------------
           NORMALIZE ROLE
        ------------------------------------------------- */

        const role =
            String(
                user.role || "inspector"
            ).toLowerCase();


        /* -------------------------------------------------
           CREATE JWT
        ------------------------------------------------- */

        const token =
            jwt.sign(
                {
                    id: user.id,
                    email: user.email,
                    role: role
                },
                JWT_SECRET,
                {
                    expiresIn: "8h"
                }
            );


        /* -------------------------------------------------
           SUCCESS
        ------------------------------------------------- */

        return res.json({

            success: true,

            message:
                "Login successful.",

            token,

            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: role
            }

        });


    } catch (error) {

        console.error(
            "Login error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Login failed."

        });

    }

});


/* =========================================================
   VERIFY TOKEN
   GET /api/auth/me
========================================================= */

router.get("/me", (req, res) => {

    try {

        const header =
            req.headers.authorization;


        if (
            !header ||
            !header.startsWith("Bearer ")
        ) {

            return res.status(401).json({
                success: false,
                message:
                    "Authentication token required."
            });

        }


        const token =
            header.substring(7);


        const decoded =
            jwt.verify(
                token,
                JWT_SECRET
            );


        const user =
            db.prepare(`
                SELECT
                    id,
                    name,
                    email,
                    role
                FROM users
                WHERE id = ?
            `).get(
                decoded.id
            );


        if (!user) {

            return res.status(401).json({
                success: false,
                message:
                    "User no longer exists."
            });

        }


        return res.json({

            success: true,

            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: String(
                    user.role
                ).toLowerCase()
            }

        });


    } catch (error) {

        return res.status(401).json({

            success: false,

            message:
                "Invalid or expired token."

        });

    }

});


module.exports = router;