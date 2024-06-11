const express = require('express');
const app = express();
const jwt = require('jsonwebtoken');
const cors = require('cors');
require('dotenv').config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 3000;

// middleware
app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.byauspy.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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
    await client.connect();

    const allMedicine = client.db("medinestDb").collection("medicine");
    const cartCollection = client.db("medinestDb").collection("carts");
    const userCollection = client.db("medinestDb").collection("users");
    const paymentCollection = client.db("medinestDb").collection("payments");

    // middlewares
    const verifyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "unauthorized access" })
      };
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "unauthorized access" })
        }
        req.decoded = decoded;
        next()
      })
    }

    // use verify admin after verifyToken
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === 'admin';
      if (!isAdmin) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      next();
    }

    // check admin 
    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" })
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === 'admin'
      }
      res.send({ admin })
    })


    // jwt related api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h"
      });
      res.send({ token })
    })

    // users related api
    // get api
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result)
    })
    // post
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exists", insertedId: null })
      }
      const result = await userCollection.insertOne(user);
      res.send(result)
    });

    app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: 'admin'
        }
      }
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })

    // user delete api
    app.delete('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await userCollection.deleteOne(query);
      res.send(result);
    })

    // get data by category
    app.get('/medicine/:category', async (req, res) => {
      const cursor = allMedicine.find({ category: req.params.category });
      const result = await cursor.toArray();
      res.send(result)
    })

    // post medicine
    app.post('/medicine', async (req, res) => {
      const item = req.body;
      const result = await allMedicine.insertOne(item);
      res.send(result);
    });

    // get all medicines
    app.get("/medicine", async (req, res) => {
      const result = await allMedicine.find().toArray();
      res.send(result)
    });

    // get the specific medicine 
    app.get("/medicines/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await allMedicine.findOne(query);
      res.send(result)
    })
    // delete a medicine
    app.delete("/medicine/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await allMedicine.deleteOne(query);
      res.send(result)
    });
    // update a medicine
    app.patch('/medicines/:id', async (req, res) => {
      const item = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          name: item.name,
          category: item.category,
          price_per_unit: item.price_per_unit,
          description: item.description,
          image: item.image
        }
      }

      const result = await allMedicine.updateOne(filter, updatedDoc)
      res.send(result);
    })

    // carts collection
    // get api
    app.get("/carts", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await cartCollection.find(query).toArray();
      res.send(result)
    });

    // post api
    app.post("/carts", async (req, res) => {
      const cartItem = req.body;
      const result = await cartCollection.insertOne(cartItem);
      res.send(result)
    });

    // delete from cart api
    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      res.send(result)
    });
    // payment intent
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      console.log(amount, "amount inside")
      // Create a PaymentIntent with the order amount and currency
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"]
      });
      res.send({
        clientSecret: paymentIntent.client_secret
      })

    });

    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);
      // carefully delete each item from the cart
      console.log("payment info", payment);
      const query = {
        _id: {
          $in: payment.cartIds.map(id => new ObjectId(id))
        }
      };
      const deleteResult = await cartCollection.deleteMany(query);
      res.send({ paymentResult, deleteResult })
    });

    app.get("/payments/:email", verifyToken, async (req, res) => {
      const query = { email: req.params.email };
      if (req.params.email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const result = await paymentCollection.find().toArray();
      res.send(result)
    })

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('medinest is running');
});

app.listen(port, () => {
  console.log(`Medinest is running on port ${port}`);
});
