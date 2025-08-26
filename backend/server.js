// server.js - Main server file
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const csvParser = require('csv-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key_here';
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://maxmp717:Max%4012345@cluster0.xgusx9b.mongodb.net/test_management?retryWrites=true&w=majority&appName=Cluster0';

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Create uploads directory if it doesn't exist
const uploadsDir = './uploads';
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

// MongoDB Connection
mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected successfully'))
.catch(err => console.log('MongoDB connection error:', err));

// Schemas
const adminSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    name: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

const questionSchema = new mongoose.Schema({
    questionText: { type: String, required: true },
    options: {
        A: { type: String, required: true },
        B: { type: String, required: true },
        C: { type: String, required: true },
        D: { type: String, required: true }
    },
    correctAnswer: { type: String, required: true, enum: ['A', 'B', 'C', 'D'] },
    createdAt: { type: Date, default: Date.now }
});

const testSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, default: '' },
    questions: [questionSchema],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Models
const Admin = mongoose.model('Admin', adminSchema);
const Test = mongoose.model('Test', testSchema);

// Multer configuration for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ 
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
            cb(null, true);
        } else {
            cb(new Error('Only CSV files are allowed'), false);
        }
    }
});

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, admin) => {
        if (err) {
            return res.status(403).json({ message: 'Invalid token' });
        }
        req.admin = admin;
        next();
    });
};

// Routes

// Admin Registration (for initial setup)
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, name } = req.body;

        // Check if admin already exists
        const existingAdmin = await Admin.findOne({ email });
        if (existingAdmin) {
            return res.status(400).json({ message: 'Admin already exists' });
        }

        // Hash password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Create new admin
        const admin = new Admin({
            email,
            password: hashedPassword,
            name
        });

        await admin.save();

        // Generate JWT token
        const token = jwt.sign(
            { id: admin._id, email: admin.email },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(201).json({
            message: 'Admin registered successfully',
            token,
            admin: {
                id: admin._id,
                email: admin.email,
                name: admin.name
            }
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Server error during registration' });
    }
});

// Admin Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find admin by email
        const admin = await Admin.findOne({ email });
        if (!admin) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Check password
        const isPasswordValid = await bcrypt.compare(password, admin.password);
        if (!isPasswordValid) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Generate JWT token
        const token = jwt.sign(
            { id: admin._id, email: admin.email },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            message: 'Login successful',
            token,
            admin: {
                id: admin._id,
                email: admin.email,
                name: admin.name
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error during login' });
    }
});

// Verify token endpoint
app.get('/api/auth/verify', authenticateToken, (req, res) => {
    res.json({ valid: true, admin: req.admin });
});

// Create Test
app.post('/api/tests', authenticateToken, async (req, res) => {
    try {
        const { title, description } = req.body;

        const test = new Test({
            title,
            description: description || '',
            questions: [],
            createdBy: req.admin.id
        });

        await test.save();

        res.status(201).json({
            message: 'Test created successfully',
            test
        });

    } catch (error) {
        console.error('Create test error:', error);
        res.status(500).json({ message: 'Server error creating test' });
    }
});

// Get All Tests
app.get('/api/tests', authenticateToken, async (req, res) => {
    try {
        const tests = await Test.find({ createdBy: req.admin.id })
            .sort({ createdAt: -1 });

        res.json({ tests });

    } catch (error) {
        console.error('Get tests error:', error);
        res.status(500).json({ message: 'Server error fetching tests' });
    }
});

// Get Single Test
app.get('/api/tests/:id', authenticateToken, async (req, res) => {
    try {
        const test = await Test.findOne({ 
            _id: req.params.id, 
            createdBy: req.admin.id 
        });

        if (!test) {
            return res.status(404).json({ message: 'Test not found' });
        }

        res.json({ test });

    } catch (error) {
        console.error('Get test error:', error);
        res.status(500).json({ message: 'Server error fetching test' });
    }
});

// Add Question to Test
app.post('/api/tests/:id/questions', authenticateToken, async (req, res) => {
    try {
        const { questionText, optionA, optionB, optionC, optionD, correctAnswer } = req.body;

        const test = await Test.findOne({ 
            _id: req.params.id, 
            createdBy: req.admin.id 
        });

        if (!test) {
            return res.status(404).json({ message: 'Test not found' });
        }

        const question = {
            questionText,
            options: {
                A: optionA,
                B: optionB,
                C: optionC,
                D: optionD
            },
            correctAnswer
        };

        test.questions.push(question);
        test.updatedAt = new Date();
        await test.save();

        res.status(201).json({
            message: 'Question added successfully',
            question: test.questions[test.questions.length - 1]
        });

    } catch (error) {
        console.error('Add question error:', error);
        res.status(500).json({ message: 'Server error adding question' });
    }
});

// Delete Question from Test
app.delete('/api/tests/:testId/questions/:questionId', authenticateToken, async (req, res) => {
    try {
        const { testId, questionId } = req.params;

        const test = await Test.findOne({ 
            _id: testId, 
            createdBy: req.admin.id 
        });

        if (!test) {
            return res.status(404).json({ message: 'Test not found' });
        }

        test.questions = test.questions.filter(q => q._id.toString() !== questionId);
        test.updatedAt = new Date();
        await test.save();

        res.json({ message: 'Question deleted successfully' });

    } catch (error) {
        console.error('Delete question error:', error);
        res.status(500).json({ message: 'Server error deleting question' });
    }
});

// Bulk Upload Questions via CSV
app.post('/api/tests/:id/upload-csv', authenticateToken, upload.single('csvFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const test = await Test.findOne({ 
            _id: req.params.id, 
            createdBy: req.admin.id 
        });

        if (!test) {
            return res.status(404).json({ message: 'Test not found' });
        }

        const questions = [];
        const filePath = req.file.path;

        // Parse CSV
        fs.createReadStream(filePath)
            .pipe(csvParser())
            .on('data', (row) => {
                // Expected CSV format: questionText,option1,option2,option3,option4,correctAnswer
                const question = {
                    questionText: row.questionText || row.question || '',
                    options: {
                        A: row.option1 || row.optionA || '',
                        B: row.option2 || row.optionB || '',
                        C: row.option3 || row.optionC || '',
                        D: row.option4 || row.optionD || ''
                    },
                    correctAnswer: row.correctAnswer || row.correct || ''
                };

                // Validate question
                if (question.questionText && 
                    question.options.A && question.options.B && 
                    question.options.C && question.options.D && 
                    ['A', 'B', 'C', 'D'].includes(question.correctAnswer.toUpperCase())) {
                    
                    question.correctAnswer = question.correctAnswer.toUpperCase();
                    questions.push(question);
                }
            })
            .on('end', async () => {
                try {
                    // Add questions to test
                    test.questions.push(...questions);
                    test.updatedAt = new Date();
                    await test.save();

                    // Clean up uploaded file
                    fs.unlinkSync(filePath);

                    res.json({
                        message: `${questions.length} questions uploaded successfully`,
                        questionsCount: questions.length
                    });

                } catch (saveError) {
                    console.error('Save questions error:', saveError);
                    res.status(500).json({ message: 'Error saving questions to database' });
                }
            })
            .on('error', (parseError) => {
                console.error('CSV parse error:', parseError);
                res.status(400).json({ message: 'Error parsing CSV file' });
            });

    } catch (error) {
        console.error('CSV upload error:', error);
        res.status(500).json({ message: 'Server error uploading CSV' });
    }
});

// Delete Test
app.delete('/api/tests/:id', authenticateToken, async (req, res) => {
    try {
        const test = await Test.findOneAndDelete({ 
            _id: req.params.id, 
            createdBy: req.admin.id 
        });

        if (!test) {
            return res.status(404).json({ message: 'Test not found' });
        }

        res.json({ message: 'Test deleted successfully' });

    } catch (error) {
        console.error('Delete test error:', error);
        res.status(500).json({ message: 'Server error deleting test' });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('Available endpoints:');
    console.log('POST /api/auth/register - Register admin');
    console.log('POST /api/auth/login - Admin login');
    console.log('GET /api/auth/verify - Verify token');
    console.log('POST /api/tests - Create test');
    console.log('GET /api/tests - Get all tests');
    console.log('GET /api/tests/:id - Get single test');
    console.log('POST /api/tests/:id/questions - Add question to test');
    console.log('DELETE /api/tests/:testId/questions/:questionId - Delete question');
    console.log('POST /api/tests/:id/upload-csv - Bulk upload questions');
    console.log('DELETE /api/tests/:id - Delete test');
});

module.exports = app;