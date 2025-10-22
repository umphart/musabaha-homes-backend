const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const Admin = require('./models/Admin');
const fs = require('fs');
const path = require('path');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Uploads directory created');
}
// Load env vars
dotenv.config();

const app = express();

// Security middleware
app.use(helmet());

app.use(
  cors({
    origin: [
      process.env.FRONTEND_URL,
      "https://musabaha-homes-ltd.vercel.app",
      "http://localhost:3000"
    ],
    credentials: true,
  })
);

// Serve uploaded files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Import routes
const userSubsequentPaymentsRoutes = require("./routes/userSubsequentPayments");
const plotRoutes = require('./routes/plots');
const subscriptionRoutes = require('./routes/subscriptions');
const userPaymentRoutes = require('./routes/UserPayment');
const layoutPlanRoutes = require('./routes/LayoutPlan');

// Use routes
app.use("/api/user-subsequent-payments", userSubsequentPaymentsRoutes);
app.use('/api/plots', plotRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/user-payments', userPaymentRoutes);
app.use('/api/layout-plan', layoutPlanRoutes);

// Generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'your-secret-key', {
    expiresIn: process.env.JWT_EXPIRES_IN || '30d',
  });
};

// Authentication middleware
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided, authorization denied'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const admin = await Admin.findById(decoded.id);
    
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Token is not valid'
      });
    }

    req.admin = admin;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Token is not valid'
    });
  }
};

// ====================== AUTHENTICATION ENDPOINTS ======================

// User registration endpoint
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, confirmPassword } = req.body;
    
    // Validation
    if (!name || !email || !password || !confirmPassword) {
      return res.status(400).json({ 
        success: false,
        message: 'Please provide all required fields' 
      });
    }
    
    if (password !== confirmPassword) {
      return res.status(400).json({ 
        success: false,
        message: 'Passwords do not match' 
      });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ 
        success: false,
        message: 'Password must be at least 6 characters' 
      });
    }
    
    // Check if user already exists
    const userExists = await User.findByEmail(email);
    if (userExists) {
      return res.status(400).json({ 
        success: false,
        message: 'User already exists with this email' 
      });
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password,
    });

    if (user) {
      res.status(201).json({
        success: true,
        data: {
          id: user.id,
          name: user.name,
          email: user.email,
          token: generateToken(user.id),
        },
        message: 'User registered successfully'
      });
    } else {
      res.status(400).json({ 
        success: false,
        message: 'Invalid user data' 
      });
    }
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error during registration' 
    });
  }
});

// User login endpoint
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validation
    if (!email || !password) {
      return res.status(400).json({ 
        success: false,
        message: 'Please provide both email and password' 
      });
    }
    
    // Check for user email
    const user = await User.findByEmail(email);

    if (user && (await User.verifyPassword(password, user.password))) {
      res.json({
        success: true,
        data: {
          id: user.id,
          name: user.name,
          email: user.email,
          token: generateToken(user.id),
        },
        message: 'Login successful'
      });
    } else {
      res.status(401).json({ 
        success: false,
        message: 'Invalid email or password' 
      });
    }
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error during login' 
    });
  }
});

// Get all users
app.get('/api/auth/users', async (req, res) => {
  try {
    const users = await User.getAll();
    res.json({
      success: true,
      data: users,
      message: 'Users fetched successfully'
    });
  } catch (error) {
    console.error('Fetch users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching users'
    });
  }
});

// Admin registration endpoint
app.post('/api/admin/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({ 
        success: false,
        message: 'Please provide all required fields' 
      });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ 
        success: false,
        message: 'Password must be at least 6 characters' 
      });
    }
    
    // Check if admin already exists
    const adminExists = await Admin.findByEmail(email);
    if (adminExists) {
      return res.status(400).json({ 
        success: false,
        message: 'Admin already exists with this email' 
      });
    }

    // Create admin
    const admin = await Admin.create({
      name,
      email,
      password,
    });

    if (admin) {
      res.status(201).json({
        success: true,
        data: {
          id: admin.id,
          name: admin.name,
          email: admin.email,
        },
        message: 'Admin registered successfully'
      });
    } else {
      res.status(400).json({ 
        success: false,
        message: 'Invalid admin data' 
      });
    }
    
  } catch (error) {
    console.error('Admin registration error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error during admin registration' 
    });
  }
});

// Admin login endpoint
app.post('/api/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validation
    if (!email || !password) {
      return res.status(400).json({ 
        success: false,
        message: 'Please provide both email and password' 
      });
    }
    
    // Check for admin email
    const admin = await Admin.findByEmail(email);

    if (admin && (await Admin.verifyPassword(password, admin.password))) {
      res.json({
        success: true,
        data: {
          id: admin.id,
          name: admin.name,
          email: admin.email,
          token: generateToken(admin.id),
        },
        message: 'Admin login successful'
      });
    } else {
      res.status(401).json({ 
        success: false,
        message: 'Invalid email or password' 
      });
    }
    
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error during admin login' 
    });
  }
});

// User profile endpoint (protected)
app.get('/api/auth/me', async (req, res) => {
  try {
    // Check for token
    const token = req.headers.authorization;
    if (!token || !token.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false,
        message: 'Not authorized, no token provided' 
      });
    }
    
    // Verify token
    const jwtToken = token.split(' ')[1];
    const decoded = jwt.verify(jwtToken, process.env.JWT_SECRET || 'your-secret-key');
    
    // Get user from database
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return res.status(401).json({ 
        success: false,
        message: 'Not authorized, user not found' 
      });
    }
    
    res.json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email
      },
      message: 'User profile retrieved successfully'
    });
    
  } catch (error) {
    console.error('Get profile error:', error);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false,
        message: 'Not authorized, invalid token' 
      });
    }
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
});

// Admin profile endpoint (protected)
app.get('/api/admin/me', auth, async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        id: req.admin.id,
        name: req.admin.name,
        email: req.admin.email
      },
      message: 'Admin profile retrieved successfully'
    });
    
  } catch (error) {
    console.error('Get admin profile error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
});

// ====================== USER MANAGEMENT ENDPOINTS ======================

// Get all users (protected - admin only)
app.get('/api/admin/users', auth, async (req, res) => {
  try {
    // Get all users
    const users = await Admin.getAllUsers();
    
    res.json({
      success: true,
      data: users,
      message: 'Users retrieved successfully'
    });
    
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
});

// Get user by ID (protected - admin only)
app.get('/api/admin/users/:id', auth, async (req, res) => {
  try {
    // Get user by ID
    const user = await Admin.getUserById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }
    
    res.json({
      success: true,
      data: user,
      message: 'User retrieved successfully'
    });
    
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
});

// Create user (protected - admin only)
app.post('/api/admin/users', auth, async (req, res) => {
  try {
    const {
      name,
      contact,
      plot_taken,
      date_taken,
      initial_deposit,
      price_per_plot,
      payment_schedule,
      total_balance,
      status
    } = req.body;

    // Validation
    if (!name || !contact || !plot_taken || !date_taken || !initial_deposit || 
        !price_per_plot || !payment_schedule || !total_balance) {
      return res.status(400).json({ 
        success: false,
        message: 'Please provide all required fields' 
      });
    }

    // Calculate total_money_to_pay
    const total_money_to_pay = await Admin.calculateTotalMoneyToPay(plot_taken, price_per_plot);

    // Create user
    const user = await Admin.createUser({
      name,
      contact,
      plot_taken,
      date_taken,
      initial_deposit,
      price_per_plot,
      payment_schedule,
      total_balance,
      total_money_to_pay,
      status: status || 'Active'
    });

    res.status(201).json({
      success: true,
      data: user,
      message: 'User created successfully'
    });
    
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
});

// ====================== UPDATE USER ENDPOINTS ======================

// Update user (PUT - full update)
app.put('/api/admin/users/:id', auth, async (req, res) => {
  try {
    const userId = req.params.id;
    const updateData = req.body;

    // Check if user exists
    const existingUser = await Admin.getUserById(userId);
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const client = await require('./config/database').connect();

    try {
      await client.query('BEGIN');

      // Build dynamic update query based on provided fields
      const updateFields = [];
      const updateValues = [];
      let paramCount = 1;

      // Fields that can be updated
      const allowedFields = [
        'name', 'contact', 'plot_taken', 'date_taken', 'initial_deposit',
        'price_per_plot', 'payment_schedule', 'total_money_to_pay', 'status'
      ];

      allowedFields.forEach(field => {
        if (updateData[field] !== undefined) {
          updateFields.push(`${field} = $${paramCount}`);
          updateValues.push(updateData[field]);
          paramCount++;
        }
      });

      // Add updated_at timestamp
      updateFields.push(`updated_at = $${paramCount}`);
      updateValues.push(new Date());
      paramCount++;

      // Add user_id for WHERE clause
      updateValues.push(userId);

      const updateQuery = `
        UPDATE usersTable 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount}
        RETURNING *
      `;

      const result = await client.query(updateQuery, updateValues);
      const updatedUser = result.rows[0];

      // If plot_taken is being updated, handle plot status changes
      if (updateData.plot_taken !== undefined) {
        // First, reset previously taken plots to Available
        const resetPlotsQuery = `
          UPDATE plots 
          SET status = 'Available', 
              owner = NULL, 
              reserved_at = NULL, 
              updated_at = NOW()
          WHERE owner = $1
        `;
        await client.query(resetPlotsQuery, [existingUser.name]);

        // Then update new plots to Sold
        if (updateData.plot_taken && updateData.plot_taken.trim() !== '') {
          const plotNumbers = updateData.plot_taken.split(',').map(plot => plot.trim());
          
          for (const plotNumber of plotNumbers) {
            const updatePlotQuery = `
              UPDATE plots 
              SET status = 'Sold', 
                  owner = $1, 
                  reserved_at = NOW(), 
                  updated_at = NOW()
              WHERE number = $2
              RETURNING *
            `;
            
            const plotValues = [updatedUser.name, plotNumber];
            await client.query(updatePlotQuery, plotValues);
          }
        }
      }

      // If initial_deposit or total_money_to_pay is updated, recalculate balance
      if (updateData.initial_deposit !== undefined || updateData.total_money_to_pay !== undefined) {
        const payments = await Admin.getPaymentsByUser(userId);
        const totalSubsequentPayments = payments.reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
        const totalPaid = parseFloat(updatedUser.initial_deposit || 0) + totalSubsequentPayments;
        const currentBalance = Math.max(0, parseFloat(updatedUser.total_money_to_pay) - totalPaid);
        
        // Update balance and status
        let status = updatedUser.status;
        if (currentBalance <= 0) {
          status = 'Completed';
        } else if (currentBalance > 0 && status === 'Completed') {
          status = 'Active';
        }

        const updateBalanceQuery = `
          UPDATE usersTable 
          SET total_balance = $1, status = $2 
          WHERE id = $3
        `;
        await client.query(updateBalanceQuery, [currentBalance, status, userId]);
        
        // Update the returned user data
        updatedUser.total_balance = currentBalance;
        updatedUser.status = status;
      }

      await client.query('COMMIT');

      res.json({
        success: true,
        message: 'User updated successfully',
        user: updatedUser
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user',
      error: error.message
    });
  }
});

// Partial update user (PATCH)
app.patch('/api/admin/users/:id', auth, async (req, res) => {
  try {
    const userId = req.params.id;
    const updateData = req.body;

    // Check if user exists
    const existingUser = await Admin.getUserById(userId);
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const client = await require('./config/database').connect();

    try {
      await client.query('BEGIN');

      // Build dynamic update query based on provided fields
      const updateFields = [];
      const updateValues = [];
      let paramCount = 1;

      // Fields that can be updated
      const allowedFields = [
        'name', 'contact', 'plot_taken', 'date_taken', 'initial_deposit',
        'price_per_plot', 'payment_schedule', 'total_money_to_pay'
      ];

      allowedFields.forEach(field => {
        if (updateData[field] !== undefined) {
          updateFields.push(`${field} = $${paramCount}`);
          updateValues.push(updateData[field]);
          paramCount++;
        }
      });

      // Add updated_at timestamp
      updateFields.push(`updated_at = $${paramCount}`);
      updateValues.push(new Date());
      paramCount++;

      // Add user_id for WHERE clause
      updateValues.push(userId);

      const updateQuery = `
        UPDATE usersTable 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount}
        RETURNING *
      `;

      const result = await client.query(updateQuery, updateValues);
      const updatedUser = result.rows[0];

      // Handle plot updates if plot_taken was modified
      if (updateData.plot_taken !== undefined) {
        // Reset previous plots
        const resetPlotsQuery = `
          UPDATE plots 
          SET status = 'Available', 
              owner = NULL, 
              reserved_at = NULL, 
              updated_at = NOW()
          WHERE owner = $1
        `;
        await client.query(resetPlotsQuery, [existingUser.name]);

        // Update new plots
        if (updateData.plot_taken && updateData.plot_taken.trim() !== '') {
          const plotNumbers = updateData.plot_taken.split(',').map(plot => plot.trim());
          
          for (const plotNumber of plotNumbers) {
            const updatePlotQuery = `
              UPDATE plots 
              SET status = 'Sold', 
                  owner = $1, 
                  reserved_at = NOW(), 
                  updated_at = NOW()
              WHERE number = $2
            `;
            await client.query(updatePlotQuery, [updatedUser.name, plotNumber]);
          }
        }
      }

      // Recalculate balance if financial fields were updated
      if (updateData.initial_deposit !== undefined || updateData.total_money_to_pay !== undefined) {
        const payments = await Admin.getPaymentsByUser(userId);
        const totalSubsequentPayments = payments.reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
        const totalPaid = parseFloat(updatedUser.initial_deposit || 0) + totalSubsequentPayments;
        const currentBalance = Math.max(0, parseFloat(updatedUser.total_money_to_pay) - totalPaid);
        
        let status = updatedUser.status;
        if (currentBalance <= 0) {
          status = 'Completed';
        } else if (currentBalance > 0 && status === 'Completed') {
          status = 'Active';
        }

        const updateBalanceQuery = `
          UPDATE usersTable 
          SET total_balance = $1, status = $2 
          WHERE id = $3
        `;
        await client.query(updateBalanceQuery, [currentBalance, status, userId]);
      }

      await client.query('COMMIT');

      // Get the final updated user with calculated balances
      const finalUser = await Admin.getUserById(userId);

      res.json({
        success: true,
        message: 'User updated successfully',
        user: finalUser
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user',
      error: error.message
    });
  }
});

// ====================== DELETE USER ENDPOINT ======================

// Delete user
app.delete('/api/admin/users/:id', auth, async (req, res) => {
  try {
    const userId = req.params.id;

    // Check if user exists
    const existingUser = await Admin.getUserById(userId);
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const client = await require('./config/database').connect();

    try {
      await client.query('BEGIN');

      // 1. Reset plots associated with this user
      if (existingUser.plot_taken) {
        const plotNumbers = existingUser.plot_taken.split(',').map(plot => plot.trim());
        
        for (const plotNumber of plotNumbers) {
          const resetPlotQuery = `
            UPDATE plots 
            SET status = 'Available', 
                owner = NULL, 
                reserved_at = NULL, 
                updated_at = NOW()
            WHERE number = $1
          `;
          await client.query(resetPlotQuery, [plotNumber]);
        }
      }

      // 2. Delete all payments associated with this user
      const deletePaymentsQuery = 'DELETE FROM payments WHERE user_id = $1';
      await client.query(deletePaymentsQuery, [userId]);

      // 3. Delete the user
      const deleteUserQuery = 'DELETE FROM usersTable WHERE id = $1 RETURNING *';
      const result = await client.query(deleteUserQuery, [userId]);
      const deletedUser = result.rows[0];

      await client.query('COMMIT');

      res.json({
        success: true,
        message: 'User deleted successfully',
        user: deletedUser
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete user',
      error: error.message
    });
  }
});

// ====================== PAYMENT MANAGEMENT ENDPOINTS ======================

// Create payment (protected - admin only)
app.post('/api/admin/payments', auth, async (req, res) => {
  try {
    const {
      user_id,
      amount,
      date,
      note,
      admin: adminName
    } = req.body;

    // Validation
    if (!user_id || !amount || !date) {
      return res.status(400).json({ 
        success: false,
        message: 'Please provide user_id, amount, and date' 
      });
    }

    // Create payment
    const payment = await Admin.createPayment({
      user_id,
      amount,
      date,
      note,
      admin: adminName || req.admin.email
    });

    res.status(201).json({
      success: true,
      data: payment,
      message: 'Payment created successfully'
    });
    
  } catch (error) {
    console.error('Create payment error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
});

// Get payments by user ID (protected - admin only)
app.get('/api/admin/payments/user/:id', auth, async (req, res) => {
  try {
    // Get payments by user ID
    const payments = await Admin.getPaymentsByUser(req.params.id);
    
    res.json({
      success: true,
      data: payments,
      message: 'Payments retrieved successfully'
    });
    
  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
});

// ====================== HEALTH CHECK ENDPOINT ======================

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true,
    message: 'Musabaha Homes API server is running!',
    timestamp: new Date().toISOString()
  });
});
 
// ====================== ERROR HANDLING MIDDLEWARE ======================

// Handle 404 - This should be AFTER all other routes
app.all('*', (req, res) => {
  res.status(404).json({ 
    success: false,
    message: 'API endpoint not found' 
  });
});

// Error handling middleware - This should be AFTER all other routes
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({ 
    success: false,
    message: 'Internal server error' 
  });
});

// ====================== SERVER START ======================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: https://musabaha-homes.onrender.com:${PORT}/api/health`);

});