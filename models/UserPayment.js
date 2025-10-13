// models/UserPayment.js
const pool = require("../config/database");

const UserPayment = {
  /**
   * Create a new payment record
   */
  async create(paymentData) {
    const {
      user_id,
      subscription_id,
      plot_id,
      amount,
      payment_method,
      transaction_date,
      notes,
      receipt_file,
      confirmed,
      plot_size,
      number_of_plots,
      total_price,
      outstanding_balance,
      name,
      contact,
    } = paymentData;

    const query = `
      INSERT INTO userPayments 
      (user_id, subscription_id, plot_id, amount, payment_method, transaction_date, 
       notes, receipt_file, confirmed, plot_size, 
       number_of_plots, total_price, outstanding_balance, name, contact, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
      RETURNING *
    `;

    const values = [
      user_id,
      subscription_id,
      plot_id,
      amount,
      payment_method,
      transaction_date,
      notes || '', // Default to empty string if null
      receipt_file,
      confirmed,
      plot_size,
      number_of_plots,
      total_price,
      outstanding_balance,
      name,
      contact || '', // Default to empty string if null
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  },

  /**
   * Update status of a payment (approve / reject / pending)
   */
  async updateStatus(paymentId, status) {
    const query = `
      UPDATE userPayments
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;

    const result = await pool.query(query, [status, paymentId]);
    return result.rows[0];
  },

  /**
   * Get all payments for a specific user
   */
  async getByUser(userId) {
    const query = `
      SELECT * FROM userPayments 
      WHERE user_id = $1 
      ORDER BY created_at DESC
    `;
    const result = await pool.query(query, [userId]);
    return result.rows;
  },

  /**
   * Get all payments (admin view)
   */
  async getAll() {
    const query = `
      SELECT * FROM userPayments 
      ORDER BY created_at DESC
    `;
    const result = await pool.query(query);
    return result.rows;
  },
};

module.exports = UserPayment;