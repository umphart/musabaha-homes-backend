const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const LayoutPlan = require('../models/LayoutPlan');

// ========== ADD CSP MIDDLEWARE ==========
router.use((req, res, next) => {
  // Allow iframe embedding from React development servers
  res.setHeader(
    "Content-Security-Policy", 
    "frame-ancestors 'self' https://musabaha-homes.onrender.com http://localhost:3000;"
  );
  next();
});

// Ensure upload directory exists
const uploadDir = 'uploads/layout-plans';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const layoutName = req.body.layoutName || 'layout';
    const safeLayoutName = layoutName.replace(/[^a-zA-Z0-9]/g, '-');
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${safeLayoutName}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf|jpg|jpeg|png|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only PDF, images, and Word documents are allowed'));
    }
  }
});

// ========== ADD PDF VIEW ROUTE ==========
router.get('/view/:id', async (req, res) => {
  try {
    const layoutPlan = await LayoutPlan.getLayoutPlanById(req.params.id);
    
    if (!layoutPlan) {
      return res.status(404).json({ 
        success: false, 
        message: 'Layout plan not found' 
      });
    }

    if (!fs.existsSync(layoutPlan.file_path)) {
      return res.status(404).json({ 
        success: false, 
        message: 'File not found on server' 
      });
    }

    // Remove CSP header specifically for PDF viewing
    res.removeHeader("Content-Security-Policy");
    
    // Set appropriate headers for PDF viewing in browser
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${layoutPlan.filename}"`);
    
    // Stream the PDF file
    const fileStream = fs.createReadStream(layoutPlan.file_path);
    fileStream.pipe(res);
    
  } catch (error) {
    console.error('PDF view error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during PDF viewing' 
    });
  }
});

// Upload layout plan
router.post('/', upload.single('layoutPlan'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    if (!req.body.layoutName || req.body.layoutName.trim() === '') {
      // Delete the uploaded file if layout name is missing
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, message: 'Layout name is required' });
    }

    // Check if layout name already exists
    const existingLayout = await LayoutPlan.getLayoutPlanByName(req.body.layoutName);
    if (existingLayout) {
      // Delete the uploaded file if layout name exists
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ 
        success: false, 
        message: 'Layout name already exists. Please choose a different name.' 
      });
    }

    // Save to database
    const layoutPlan = await LayoutPlan.createLayoutPlan({
      layout_name: req.body.layoutName.trim(),
      filename: req.file.originalname,
      filePath: req.file.path,
      fileUrl: `/uploads/layout-plans/${req.file.filename}`,
      fileSize: req.file.size,
      uploadedBy: req.user?.id || null
    });

    res.json({ 
      success: true, 
      data: layoutPlan, 
      message: 'Layout plan uploaded successfully' 
    });
  } catch (error) {
    console.error('Upload error:', error);
    // Clean up file if error occurred
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ 
      success: false, 
      message: 'Server error during upload' 
    });
  }
});

// Get current layout plan (latest)
router.get('/', async (req, res) => {
  try {
    const layoutPlan = await LayoutPlan.getLatestLayoutPlan();
    res.json({ 
      success: true, 
      data: layoutPlan 
    });
  } catch (error) {
    console.error('Fetch error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error fetching layout plan' 
    });
  }
});

// Get all layout plans
router.get('/all', async (req, res) => {
  try {
    const layoutPlans = await LayoutPlan.getAllLayoutPlans();
    res.json({ 
      success: true, 
      data: layoutPlans 
    });
  } catch (error) {
    console.error('Fetch all error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error fetching layout plans' 
    });
  }
});

// Download layout plan
// routes/layoutPlan.js
router.get('/download/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate that id is provided and is a number
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid layout plan ID'
      });
    }

    const layoutPlan = await LayoutPlan.getLayoutPlanById(parseInt(id));
    
    if (!layoutPlan) {
      return res.status(404).json({
        success: false,
        message: 'Layout plan not found'
      });
    }

    const filePath = path.join(__dirname, '..', layoutPlan.file_url);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Layout plan file not found'
      });
    }

    // Set headers for download
    res.setHeader('Content-Disposition', `attachment; filename="${layoutPlan.filename}"`);
    res.setHeader('Content-Type', 'application/pdf');

    // Send the file
    res.sendFile(filePath);
  } catch (error) {
    console.error('Download layout plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Error downloading layout plan'
    });
  }
});
// Delete layout plan
router.delete('/:id', async (req, res) => {
  try {
    const layoutPlan = await LayoutPlan.getLayoutPlanById(req.params.id);
    
    if (!layoutPlan) {
      return res.status(404).json({ 
        success: false, 
        message: 'Layout plan not found' 
      });
    }

    // Delete file from filesystem
    if (fs.existsSync(layoutPlan.file_path)) {
      fs.unlinkSync(layoutPlan.file_path);
    }

    // Delete from database
    await LayoutPlan.deleteLayoutPlan(req.params.id);

    res.json({ 
      success: true, 
      message: 'Layout plan deleted successfully' 
    });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during deletion' 
    });
  }
});

module.exports = router;