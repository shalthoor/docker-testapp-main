const express = require("express");
const app = express();
const path = require("path");
const MongoClient = require("mongodb").MongoClient;

const PORT = 5050;
const DEFAULT_DB = "healthcheck";
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const MONGO_URL = process.env.MONGO_URL || (process.env.MONGO_ROOT_PASSWORD
    ? `mongodb://${encodeURIComponent(process.env.MONGO_ROOT_USERNAME || "admin")}:${encodeURIComponent(process.env.MONGO_ROOT_PASSWORD)}@localhost:27017/?authSource=admin`
    : "mongodb://localhost:27017");
const client = new MongoClient(MONGO_URL);

const DATABASES = {
    college: { db: "apnacollege-db", collection: "users" },
    healthcheck: { db: "mongodb-healthcheck", collection: "sharadafamily" },
};

app.get("/getUsers", async (req, res) => {
    try {
        const key = req.query.db || DEFAULT_DB;
        const target = DATABASES[key];

        if (!target) {
            return res.status(400).json({ error: `Unknown database '${key}'` });
        }

        await client.connect();
        const db = client.db(target.db);
        const data = await db.collection(target.collection).find({}).toArray();
        res.json(data);
    } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ error: "Failed to fetch users" });
    }
});

app.post("/addUser", async (req, res) => {
    try {
        const { db: key = DEFAULT_DB, ...userObj } = req.body;
        const target = DATABASES[key];

        if (!target) {
            return res.status(400).json({ error: `Unknown database '${key}'` });
        }

        if (!userObj || Object.keys(userObj).length === 0) {
            return res.status(400).json({ error: "Request body is empty" });
        }

        await client.connect();
        const db = client.db(target.db);
        const data = await db.collection(target.collection).insertOne(userObj);
        console.log("data inserted in DB", data.insertedId);

        res.status(201).json({
            insertedId: data.insertedId,
            db: target.db,
            collection: target.collection,
        });
    } catch (error) {
        console.error("Error adding user:", error);
        res.status(500).json({ error: "Failed to add user" });
    }
});

app.listen(PORT, () => {
    console.log(`server running on port ${PORT}`);
});
