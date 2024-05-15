const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;


// middleware  to handle json data in the request body
app.use(cors({
    origin: ['http://localhost:5173'],
    credentials: true
}))
app.use(express.json());
app.use(cookieParser())



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.bhgag9l.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

// middleware
const logger = (req, res, next) => {
    console.log("log info", req.method, req.url);
    next();
}


const verifyToken = (req, res, next) => {
    const token = req?.cookies?.token;
    console.log("token in the middle", token);
    if (!token) {
        return res.status(401).send({ message: "unauthorized access" })
    }
    // verifying the token using jwt library
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
        if (error) {
            return res.status(401).send({ message: "unauthorized access" })
        }
        req.user = decoded;
        next()
    })
}


const tokenOption = {
    httpOnly: true,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
    secure: process.env.NODE_ENV === "production" ? true : false,
}

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();

        const servicesCollection = client.db("carDoctor").collection("services");
        const bookingCollection = client.db("carDoctor").collection("booking");


        // JWT Related API
        app.post('/jwt', async (req, res) => {
            const userData = req.body;
            console.log(userData);
            const token = jwt.sign(userData, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "1h" })
            res.cookie("token", token, tokenOption).send({ success: true })
        })

        app.post('/logout', async (req, res) => {
            const user = req.body;
            console.log("logout user", user);
            res.clearCookie("token", { ...tokenOption, maxAge: 0 }).send({ success: true })
        })

        // Service related API
        app.get('/services', async (req, res) => {
            const filter = req.query;
            // console.log(filter);
            const query = {
                // price: { $lt: 100 }
                title: {$regex: filter.search, $options: 'i'}
            }
            const options = {
                sort: {
                    price: filter.sort === 'asy' ? 1 : -1
                }
            }
            const curser = servicesCollection.find(query, options);
            const result = await curser.toArray();
            res.send(result);

        })

        app.get('/services/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const options = {
                // Include only the `title` and `imdb` fields in the returned document
                projection: { title: 1, service_id: 1, price: 1, img: 1 },
            };
            const result = await servicesCollection.findOne(query, options);
            res.send(result);
        })

        // booking server 

        app.get('/bookings', logger, verifyToken, async (req, res) => {
            console.log(req.query.email);
            // console.log("cook cookie", req.cookies);
            console.log("token owner info", req.user);
            if (req.user.email !== req.query.email) {
                return res.status(403).send({ message: "forbidden access" })
            }

            let query = {};
            // console.log(query);
            if (req.query.email) {
                query = { email: req.query.email }
            }
            const result = await bookingCollection.find(query).toArray();
            res.send(result);
        })



        app.post('/booking', async (req, res) => {
            const userData = req.body;
            console.log(userData);
            const result = await bookingCollection.insertOne(userData);
            res.send(result)
        })

        app.delete('/bookings/:id', async (req, res) => {
            const id = req.params.id;
            console.log(id);
            const query = { _id: new ObjectId(id) };
            const result = await bookingCollection.deleteOne(query);
            res.send(result);
        })

        app.patch('/bookings/:id', async (req, res) => {
            const id = req.params.id;
            const updateData = req.body;
            const query = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    status: updateData.status
                },
            };

            const result = await bookingCollection.updateOne(query, updateDoc);
            res.send(result);
        })

        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('doctor is running')
})

app.listen(port, () => {
    console.log(`doctor is running on ${port}`);
})
