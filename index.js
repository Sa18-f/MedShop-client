const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
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

    // get data by category
    app.get('/medicine/:category', async (req, res) => {
      const cursor = allMedicine.find({ category: req.params.category });
      const result = await cursor.toArray();
      res.send(result)
    })


    // get all medicines
    app.get("/medicine", async (req, res) => {
      const result = await allMedicine.find().toArray();
      res.send(result)
    });

    // get the specific medicine 
    app.get("/medicine/:id", async (req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await allMedicine.findOne(query);
      res.send(result)
    })

    // carts collection
    // get api
    app.get("/carts", async (req, res) => {
      const result = await cartCollection.find().toArray();
      res.send(result)
    });

    // post api
    app.post("/carts", async(req, res) => {
      const cartItem = req.body;
      const result = await cartCollection.insertOne(cartItem);
      res.send(result)
    });

    // delete from cart api
    app.delete("/carts/:id", async(req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await cartCollection.deleteOne(query);
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
