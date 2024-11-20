const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_PAYMENT_SECRET_KEY);
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.712mjau.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();

        const usersCollection = client.db("doctorsDB").collection("users");
        const doctorsCollection = client.db("doctorsDB").collection("doctorsList");
        const reviewsCollection = client.db("doctorsDB").collection("patientReviews");
        const appointmentCollection = client.db("doctorsDB").collection("appointment");
        const paymentsCollection = client.db("doctorsDB").collection("payments");
        const appointmentContactCollection = client.db("doctorsDB").collection("contact");

        // jwt token related api 
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
            res.send({ token });
        });

        // use verify admin after verify token
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded?.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            const isAdmin = user?.role === 'admin';
            if (!isAdmin) {
                return res.status(403).send({ message: 'forbidden access' });
            }
            next();
        }

        const verifyToken = (req, res, next) => {

            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'unauthorized access' })
            }
            const token = req.headers.authorization.split(' ')[1];
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: 'unauthorized access' });
                }
                req.decoded = decoded;
                next();
            })
        }

        // users related api
        app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result);
        });

        // admin check to email
        app.get("/users/admin/:email", verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'forbidden access' });
            }
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            let admin = false;
            if (user) {
                admin = user?.role === 'admin'
            }
            res.send({ admin });
        });

        // users post to database
        app.post("/users", async (req, res) => {
            const user = req.body;
            const query = { email: user.email }
            const existingUser = await usersCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: 'User already is an uxists', insertedId: null })
            }
            const result = await usersCollection.insertOne(user);
            res.send(result);
        });

        // check admin role and create admin
        app.patch("/users/admin/:id", verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result);
        });

        // user deleted
        app.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await usersCollection.deleteOne(query);
            res.send(result);
        });

        // doctors related apis
        app.get("/doctors", async (req, res) => {
            const result = await doctorsCollection.find().toArray();
            res.send(result);
        });

        app.get("/doctors/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await doctorsCollection.findOne(query);
            res.send(result);
        });

        // add a doctors from admin 
        app.post("/doctors", verifyToken, verifyAdmin, async (req, res) => {
            const doctor = req.body;
            const result = await doctorsCollection.insertOne(doctor);
            res.send(result);
        });

        app.patch("/doctors/:id", verifyToken, verifyAdmin, async (req, res) => {
            const doctor = req.body;
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    name: doctor.name,
                    category: doctor.category,
                    specialist: doctor.specialist,
                    experience: doctor.experience,
                    chamberLocation: doctor.chamberLocation,
                    rating: parseFloat(doctor.rating),
                    about: doctor.about,
                    education: doctor.education,
                    overview: doctor.overview,
                    phone: doctor.phone,
                    email: doctor.email,
                    image: doctor.image,
                    visitFee: doctor.visitFee
                }
            }
            const result = await doctorsCollection.updateOne(filter, updatedDoc);
            res.send(result);
        });

        app.delete("/doctors/:id", verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await doctorsCollection.deleteOne(query);
            res.send(result);
        })

        app.get("/reviews", async (req, res) => {
            const result = await reviewsCollection.find().toArray();
            res.send(result);
        });

        app.post("/reviews", verifyToken, async (req, res) => {
            const query = req.body;
            const result = await reviewsCollection.insertOne(query);
            res.send(result);
        });

        // Appointment collection
        app.get("/appointment",verifyToken, async (req, res) => {
            const email = req.query.email;
            const query = { email: email }
            const result = await appointmentCollection.find(query).toArray();
            res.send(result);
        });

        app.post("/appointment", verifyToken, async (req, res) => {
            const appointmentDoctor = req.body;
            const result = await appointmentCollection.insertOne(appointmentDoctor);
            res.send(result);
        });

        app.delete("/appointment/:id",verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await appointmentCollection.deleteOne(query);
            res.send(result);
        });

        // contact related api
        app.get("/appointmentContact", verifyToken, verifyAdmin, async (req, res) => {
            const result = await appointmentContactCollection.find().toArray();
            res.send(result);
        });

        app.post("/appointmentContact", verifyToken, async (req, res) => {
            const email = req.body;
            const result = await appointmentContactCollection.insertOne(email);
            res.send(result);
        });

        app.delete("/appointmentContact/:id", verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await appointmentContactCollection.deleteOne(query);
            res.send(result);
        })
        
        // Payment related API
        // Create payment intent
        app.post('/create_payment-intent', verifyToken, async (req, res) => {
            const { visitFee } = req.body;
            const amount = parseInt(visitFee * 100);

            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });

            res.send({
                clientSecret: paymentIntent.client_secret
            });
        });

        app.get('/payments/:email', verifyToken, async (req, res) => {
            const query = { email: req.params.email }
            if (req.params.email !== req.decoded.email) {
                return res.status(403).send({ message: "forbidden access" });
            }
            const result = await paymentsCollection.find(query).toArray();
            res.send(result);
        })

        app.post('/payments', verifyToken, async (req, res) => {
            const payment = req.body;
            const paymentResult = await paymentsCollection.insertOne(payment);
            const query = {
                _id: {
                    $in: payment.appointmentIds.map(id => new ObjectId(id))
                }
            }

            const deleteResult = await appointmentCollection.deleteMany(query);
            res.send({ paymentResult, deleteResult })

        });

        // stats for admin home
        app.get('/admin-stats', verifyToken, verifyAdmin, async (req, res) => {
            const patients = await usersCollection.estimatedDocumentCount();
            const doctors = await doctorsCollection.estimatedDocumentCount();
            const appointments = await paymentsCollection.estimatedDocumentCount();

            const result = await paymentsCollection.aggregate([
                {
                    $group: {
                        _id: null,
                        totalRevenue: {
                            $sum: "$visitFee"
                        }
                    }
                }
            ]).toArray();

            const revenue = result.length > 0 ? result[0].totalRevenue : 0;

            res.send({
                patients,
                doctors,
                appointments,
                revenue
            });
        });

        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        // console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



app.get("/", (req, res) => {
    res.send("Doctor Clinic");
})

app.listen(port, () => {
    console.log(`Doctor clinic server port are ${port}`);
})

