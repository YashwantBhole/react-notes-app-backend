const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');

const app = express();
app.use(express.json());

const allowedOrigins = [
  'http://localhost:5173', // Local Vite dev server
  'https://notezen.netlify.app/' //netlify URL
];

app.use(cors({
  origin: allowedOrigins,
  credentials: true // Only if you're using cookies or auth tokens in headers
}));


const uri = 'mongodb://127.0.0.1:27017';
const dbName = 'notes-app';
const collectionName = 'notes-app-users';
let client;
let db;

// Establish a global MongoDB connection when the app starts
async function connectToDB() {
    try {
        client = new MongoClient(uri);
        await client.connect();
        db = client.db(dbName); // Set the database
        console.log('Connected to the database');
    } catch (err) {
        console.error('Error connecting to MongoDB:', err);
        process.exit(1); // Exit if connection fails
    }
}

// Call connectToDB when the server starts
connectToDB();


// Routes
// Home route
app.get('/', (req, res) => {
    res.status(200).json({ message: 'Server started...' });
});

// Signup route
app.post('/api/signup', async (req, res) => {
    const { name, username, password, Date } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    try {
        const collection = db.collection(collectionName);
        const existingUser = await collection.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ error: 'Username already exists' });
        }

        await collection.insertOne({ name, username, password, Date });
        res.status(200).json({ message: 'User added successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Something went wrong' });
    }
});

// Sign-in route
app.post('/api/signin', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    try {
        const collection = db.collection(collectionName);
        const user = await collection.findOne({ username, password });
        if (!user) {
            return res.status(500).json({ error: 'User not found. Invalid credentials.' });
        }
        res.status(200).json({ message: 'Sign-in successful! Welcome.', user });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Something went wrong' });
    }
});


//addNotes route
// Notes store route
app.post('/api/notes', async (req, res) => {
    const { username, title, note, date } = req.body;

    // Basic validation
    if (!username || !title || !note || !date) {
        return res.status(400).json({ message: 'All fields are required.' });
    }
    try {
        const collection = db.collection(collectionName);
        const result = await collection.insertOne({
            username,
            title,
            note,
            date,
        });

        res.status(201).json({ message: "Notes saved successfully..!", noteId: result.insertedId })

    } catch (error) {
        console.log(error)
        res.status(500).json({ message: "An error occured while adding note...." })
    }

});

//showNotes route
// Get route to fetch user notes
app.get('/api/notes', async (req, res) => {
    const { username } = req.query;

    if (!username) {
        return res.status(400).json({ message: 'Username is required' });
    }

    try {
        const notes = await db.collection(collectionName)
            .find({
                username,
                title: { $exists: true }
            })
            .project({ title: 1, note: 1, date: 1 })
            .toArray();

        res.status(200).json(notes);

    } catch (err) {
        console.error('Error fetching data', err);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});



// Delete route
app.delete('/api/notes/:id', async (req, res) => {
    const { id } = req.params;
    const { username } = req.query;

    if (!username) {
        return res.status(400).json({ message: "Username is required" });
    }

    console.log(username, id)
    try {
        const db = client.db(dbName);
        const result = await db.collection(collectionName)
            .deleteOne({
                _id: new ObjectId(id),
                username,
                title: { $exists: true }
            })
        if (result.deletedCount === 0) {
            return res.status(404).json({ message: "Note not found" })
        }

        res.status(200).json({ message: "Note deleted successfully" });
    } catch (err) {
        console.error("Error deleting note:", err);
        res.status(500).json({ message: "Server error" });
    }
});



//Update Route
// PUT /api/notes/:id
app.put('/api/notes/:id', async (req, res) => {
  const { id } = req.params;
  const { title, note } = req.body;

  if (!title || !note) {
    return res.status(400).json({ message: "Title and note contents are required." });
  }

  try {
    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    const result = await collection.updateOne(
      {
        _id: new ObjectId(id),
        title: { $exists: true } // ensures it's a note, not user profile
      },
      {
        $set: {
          title,
          note,
          date: new Date().toLocaleString() // Optional: update timestamp
        }
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "Note not found." });
    }

    res.status(200).json({ message: "Note updated successfully." });
  } catch (error) {
    console.error("Error updating note:", error);
    res.status(500).json({ message: "Internal server error." });
  }
});



// Start the Development server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server started at http://localhost:${PORT}`);
});
