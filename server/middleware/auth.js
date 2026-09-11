const jwt = require("jsonwebtoken");
const db = require("../database/database");

const JWT_SECRET =
    process.env.JWT_SECRET ||
    "coalguard-development-secret";


/* =========================================================
   AUTHENTICATE JWT
   ========================================================= */

function authenticateToken(req, res, next) {

    const header = req.headers.authorization;


    if (
        !header ||
        !header.startsWith("Bearer ")
    ) {

        return res.status(401).json({
            success: false,
            message: "Authentication token required."
        });

    }


    const token = header.substring(7);


    try {

        const decoded =
            jwt.verify(
                token,
                JWT_SECRET
            );


        /*
         * Check that the user still exists
         * in the database.
         */

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
                message: "User no longer exists."
            });

        }


        /*
         * Store authenticated user
         * on the request.
         */

        req.user = {

            id: user.id,

            name: user.name,

            email: user.email,

            role: String(
                user.role || ""
            ).toLowerCase()

        };


        next();


    } catch (error) {

        return res.status(401).json({

            success: false,

            message:
                "Invalid or expired token."

        });

    }

}


/* =========================================================
   ROLE AUTHORIZATION
   ========================================================= */

function requireRoles(...allowedRoles) {

    const normalizedRoles =
        allowedRoles.map(
            role =>
                String(
                    role
                ).toLowerCase()
        );


    return (req, res, next) => {

        const role =
            String(
                req.user?.role || ""
            ).toLowerCase();


        if (
            !normalizedRoles.includes(
                role
            )
        ) {

            return res.status(403).json({

                success: false,

                message:
                    "Access denied. Manager or Admin role required."

            });

        }


        next();

    };

}


module.exports = {

    authenticateToken,

    requireRoles

};