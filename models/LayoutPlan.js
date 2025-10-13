const pool = require('../config/database');

const LayoutPlan = {
  async createLayoutPlan(layoutData) {
    const { layout_name, filename, filePath, fileUrl, fileSize, uploadedBy } = layoutData;
    
    const query = `
      INSERT INTO layout_plans (layout_name, filename, file_path, file_url, file_size, uploaded_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    
    const values = [layout_name, filename, filePath, fileUrl, fileSize, uploadedBy || null];
    const result = await pool.query(query, values);
    return result.rows[0];
  },

  async getLatestLayoutPlan() {
    const query = 'SELECT * FROM layout_plans ORDER BY created_at DESC LIMIT 1';
    const result = await pool.query(query);
    return result.rows[0];
  },

  async getLayoutPlanById(id) {
    const query = 'SELECT * FROM layout_plans WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0];
  },

  async deleteLayoutPlan(id) {
    const query = 'DELETE FROM layout_plans WHERE id = $1 RETURNING *';
    const result = await pool.query(query, [id]);
    return result.rows[0];
  },

  async getAllLayoutPlans() {
    const query = 'SELECT * FROM layout_plans ORDER BY created_at DESC';
    const result = await pool.query(query);
    return result.rows;
  },

  async getLayoutPlanByName(layoutName) {
    const query = 'SELECT * FROM layout_plans WHERE layout_name = $1';
    const result = await pool.query(query, [layoutName]);
    return result.rows[0];
  }
};

module.exports = LayoutPlan;