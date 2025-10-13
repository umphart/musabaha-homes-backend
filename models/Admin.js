// models/Admin.js
const db = require('../config/database');
const bcrypt = require('bcryptjs');

const Admin = {
  // ====================== Admin ======================

  async create(adminData) {
    const { name, email, password } = adminData;
    const hashedPassword = await bcrypt.hash(password, 10);

    const query = `
      INSERT INTO admins (name, email, password)
      VALUES ($1, $2, $3)
      RETURNING id, name, email, created_at, updated_at
    `;

    const values = [name, email, hashedPassword];

    try {
      const result = await db.query(query, values);
      return result.rows[0];
    } catch (error) {
      if (error.code === '23505') {
        throw new Error('Admin with this email already exists');
      }
      throw error;
    }
  },

  async findByEmail(email) {
    const query = 'SELECT * FROM admins WHERE email = $1';
    const result = await db.query(query, [email]);
    return result.rows[0];
  },

  async findById(id) {
    const query = 'SELECT id, name, email, created_at, updated_at FROM admins WHERE id = $1';
    const result = await db.query(query, [id]);
    return result.rows[0];
  },

  async verifyPassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  },

  // ====================== Users (usersTable) ======================

  async createUser(userData) {
    const {
      name,
      contact,
      plot_taken,
      date_taken,
      initial_deposit,
      price_per_plot,
      payment_schedule,
      total_money_to_pay
    } = userData;

    const client = await db.getClient(); // Use getClient instead of pool.connect

    try {
      await client.query('BEGIN');
      const initialDepositValue = parseFloat(initial_deposit) || 0;
      const total_balance = total_money_to_pay - initialDepositValue;
      const status = initialDepositValue >= total_money_to_pay ? 'Completed' : 'Active';

      // Insert user
      const userQuery = `
        INSERT INTO usersTable 
        (name, contact, plot_taken, date_taken, initial_deposit, price_per_plot, 
         payment_schedule, total_balance, total_money_to_pay, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `;

      const userValues = [
        name,
        contact,
        plot_taken,
        date_taken,
        initial_deposit,
        price_per_plot,
        payment_schedule,
        total_balance,
        total_money_to_pay,
        status
      ];

      console.log('Inserting into database with values:', userValues);

      const userResult = await client.query(userQuery, userValues);
      const newUser = userResult.rows[0];

      // Update plots status
      if (plot_taken) {
        const plotNumbers = plot_taken.split(',').map(plot => plot.trim());
        
        for (const plotNumber of plotNumbers) {
          const updatePlotQuery = `
            UPDATE plots 
            SET status = 'Sold', 
                owner = $1, 
                reserved_at = NOW(), 
                updated_at = NOW()
            WHERE number = $2 AND status = 'Available'
            RETURNING *
          `;
          
          const plotValues = [name, plotNumber];
          await client.query(updatePlotQuery, plotValues);
        }
      }

      await client.query('COMMIT');
      return newUser;

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error creating user and updating plots:', error);
      throw error;
    } finally {
      client.release();
    }
  },

  async getAllUsers() {
    const query = 'SELECT * FROM usersTable ORDER BY id ASC';
    const result = await db.query(query);
    
    const usersWithUpdatedBalance = await Promise.all(
      result.rows.map(async (user) => {
        const payments = await this.getPaymentsByUser(user.id);
        const totalSubsequentPayments = payments.reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
        const totalPaid = parseFloat(user.initial_deposit || 0) + totalSubsequentPayments;
        const currentBalance = Math.max(0, parseFloat(user.total_money_to_pay) - totalPaid);
        
        let status = user.status;
        if (currentBalance <= 0 && user.status !== 'Completed') {
          status = 'Completed';
          await db.query(
            'UPDATE usersTable SET status = $1, total_balance = $2 WHERE id = $3',
            [status, 0, user.id]
          );
        } else if (currentBalance > 0 && user.status === 'Completed') {
          status = 'Active';
          await db.query(
            'UPDATE usersTable SET status = $1, total_balance = $2 WHERE id = $3',
            [status, currentBalance, user.id]
          );
        } else {
          await db.query(
            'UPDATE usersTable SET total_balance = $1 WHERE id = $2',
            [currentBalance, user.id]
          );
        }

        return {
          ...user,
          total_balance: currentBalance,
          total_paid: totalPaid,
          status: status,
          payments: payments
        };
      })
    );

    return usersWithUpdatedBalance;
  },

  async getUserById(userId) {
    const query = 'SELECT * FROM usersTable WHERE id = $1';
    const result = await db.query(query, [userId]);
    
    if (result.rows.length === 0) {
      return null;
    }

    const user = result.rows[0];
    const payments = await this.getPaymentsByUser(userId);
    const totalSubsequentPayments = payments.reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
    const totalPaid = parseFloat(user.initial_deposit || 0) + totalSubsequentPayments;
    const currentBalance = Math.max(0, parseFloat(user.total_money_to_pay) - totalPaid);
    
    let status = user.status;
    if (currentBalance <= 0 && user.status !== 'Completed') {
      status = 'Completed';
      await db.query(
        'UPDATE usersTable SET status = $1, total_balance = $2 WHERE id = $3',
        [status, 0, userId]
      );
    } else if (currentBalance > 0 && user.status === 'Completed') {
      status = 'Active';
      await db.query(
        'UPDATE usersTable SET status = $1, total_balance = $2 WHERE id = $3',
        [status, currentBalance, userId]
      );
    } else {
      await db.query(
        'UPDATE usersTable SET total_balance = $1 WHERE id = $2',
        [currentBalance, userId]
      );
    }

    return {
      ...user,
      total_balance: currentBalance,
      total_paid: totalPaid,
      status: status,
      payments: payments
    };
  },

  // ====================== Payments ======================

  async createPayment(paymentData) {
    const { user_id, amount, date, note, admin, recorded_by } = paymentData;
    const recorder = recorded_by || admin;

    const client = await db.getClient(); // Use getClient here

    try {
      await client.query('BEGIN');

      const paymentQuery = `
        INSERT INTO payments (user_id, amount, date, note, recorded_by)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;
      const paymentValues = [user_id, amount, date, note, recorder];
      const paymentResult = await client.query(paymentQuery, paymentValues);
      const payment = paymentResult.rows[0];

      const userQuery = 'SELECT * FROM usersTable WHERE id = $1';
      const userResult = await client.query(userQuery, [user_id]);
      const user = userResult.rows[0];

      if (!user) {
        throw new Error('User not found');
      }

      const paymentsQuery = 'SELECT * FROM payments WHERE user_id = $1';
      const paymentsResult = await client.query(paymentsQuery, [user_id]);
      const userPayments = paymentsResult.rows;

      const totalSubsequentPayments = userPayments.reduce(
        (sum, p) => sum + parseFloat(p.amount || 0),
        0
      );
      const totalPaid =
        parseFloat(user.initial_deposit || 0) + totalSubsequentPayments;
      const currentBalance = Math.max(
        0,
        parseFloat(user.total_money_to_pay || 0) - totalPaid
      );

      let status = user.status;
      if (currentBalance <= 0) {
        status = 'Completed';
      } else if (currentBalance > 0 && status === 'Completed') {
        status = 'Active';
      }

      const updateUserQuery = `
        UPDATE usersTable 
        SET total_balance = $1, status = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
      `;
      const updateValues = [currentBalance, status, user_id];
      await client.query(updateUserQuery, updateValues);

      await client.query('COMMIT');

      return {
        success: true,
        payment: {
          ...payment,
          user_balance: currentBalance,
          user_status: status,
          total_paid: totalPaid
        }
      };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error creating payment:', error);
      return {
        success: false,
        message: error.message || 'Failed to create payment'
      };
    } finally {
      client.release();
    }
  },

  async getPaymentsByUser(userId) {
    const query = `
      SELECT * FROM payments 
      WHERE user_id = $1 
      ORDER BY date DESC, created_at DESC
    `;
    const result = await db.query(query, [userId]);
    return result.rows;
  },

  // ====================== Helper function to calculate total money to pay ======================
  async calculateTotalMoneyToPay(plotTaken, pricePerPlot) {
    try {
      if (!plotTaken || !pricePerPlot) return 0;
      
      const plots = plotTaken.split(',').map(plot => plot.trim());
      const numberOfPlots = plots.length;
      
      const prices = pricePerPlot.split(',').map(price => {
        const parsed = parseFloat(price.trim());
        return isNaN(parsed) ? 0 : parsed;
      });
      
      let total = 0;
      for (let i = 0; i < Math.min(numberOfPlots, prices.length); i++) {
        total += prices[i];
      }
      
      return total;
    } catch (error) {
      console.error('Error calculating total money to pay:', error);
      return 0;
    }
  },

  async getUserFinancialDetails(userId) {
    const user = await this.getUserById(userId);
    if (!user) return null;

    const payments = await this.getPaymentsByUser(userId);
    const totalSubsequentPayments = payments.reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
    const totalPaid = parseFloat(user.initial_deposit || 0) + totalSubsequentPayments;
    const currentBalance = Math.max(0, parseFloat(user.total_money_to_pay) - totalPaid);

    return {
      ...user,
      initial_deposit: parseFloat(user.initial_deposit || 0),
      total_subsequent_payments: totalSubsequentPayments,
      total_paid: totalPaid,
      remaining_balance: currentBalance,
      is_completed: currentBalance <= 0,
      payment_progress: (totalPaid / parseFloat(user.total_money_to_pay)) * 100
    };
  }
};

module.exports = Admin;