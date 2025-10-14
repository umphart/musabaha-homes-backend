const pool = require('../config/database');

const Subscription = {
  create: async (data) => {
    const client = await pool.connect(); // This should now work
    
    try {
      await client.query('BEGIN');

      // Map frontend field names to database column names
      const fieldMap = {
        title: 'title',
        name: 'name',
        residentialAddress: 'residential_address',
        occupation: 'occupation',
        officeAddress: 'office_address',
        dob: 'dob',
        stateOfOrigin: 'state_of_origin',
        lga: 'lga',
        sex: 'sex',
        phoneNumber: 'phone_number', 
        nationality: 'nationality',
        homeNumber: 'home_number',
        email: 'email',
        identification: 'identification',
        passportPhoto: 'passport_photo',
        identificationFile: 'identification_file',
        nextOfKinName: 'next_of_kin_name',
        nextOfKinAddress: 'next_of_kin_address',
        nextOfKinRelationship: 'next_of_kin_relationship',
        nextOfKinPhoneNumber: 'next_of_kin_phone_number', 
        nextOfKinOccupation: 'next_of_kin_occupation',
        nextOfKinOfficeAddress: 'next_of_kin_office_address',
        layoutName: 'layout_name', 
        numberOfPlots: 'number_of_plots',
        proposedUse: 'proposed_use',
        proposedType: 'proposed_type',
        plotSize: 'plot_size',
        paymentTerms: 'payment_terms',
        price: 'price',
        price_per_plot: 'price_per_plot',
        agreedToTerms: 'agreed_to_terms',
        signatureText: 'signature_text',
        signatureFile: 'signature_file',
        plotId: 'plot_id',
        plot_ids: 'plot_ids',
      };

      // Filter out undefined values and map to database columns
      const columns = [];
      const values = [];
      const placeholders = [];
      
      let paramCount = 1;
      for (const [key, value] of Object.entries(data)) {
        if (value !== undefined && value !== null && fieldMap[key]) {
          columns.push(fieldMap[key]);
          values.push(value);
          placeholders.push(`$${paramCount}`);
          paramCount++;
        }
      }

      // Add created_at timestamp
      columns.push('created_at');
      values.push(new Date());
      placeholders.push(`$${paramCount}`);

      if (columns.length === 0) {
        throw new Error('No valid data provided for insertion');
      }

      const query = `
        INSERT INTO subscriptions (${columns.join(', ')})
        VALUES (${placeholders.join(', ')})
        RETURNING *;
      `;

      console.log('Executing query:', query);
      console.log('With values:', values);
      
      const result = await client.query(query, values);
      
      await client.query('COMMIT');
      return result.rows[0];
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Database error in create:', error);
      throw error;
    } finally {
      client.release();
    }
  },

  getAll: async () => {
    try {
      const query = 'SELECT * FROM subscriptions ORDER BY created_at DESC';
      const result = await pool.query(query);
      return result.rows;
    } catch (error) {
      console.error('Database error in getAll:', error);
      throw error;
    }
  },

  getById: async (id) => {
    try {
      const query = 'SELECT * FROM subscriptions WHERE id = $1';
      const result = await pool.query(query, [id]);
      
      if (result.rows[0]) {
        const subscription = result.rows[0];
        
        // Parse plot_ids if it exists and is a string
        if (subscription.plot_ids && typeof subscription.plot_ids === 'string') {
          subscription.plot_ids_array = subscription.plot_ids.split(',')
            .map(plotId => plotId.trim())
            .filter(plotId => plotId !== '');
        } else {
          subscription.plot_ids_array = [];
        }
        
        return subscription;
      }
      
      return null;
    } catch (error) {
      console.error('Database error in getById:', error);
      throw error;
    }
  },

  findByEmail: async (email) => {
    try {
      const query = 'SELECT * FROM subscriptions WHERE email = $1 ORDER BY created_at DESC';
      const result = await pool.query(query, [email]);
      return result.rows;
    } catch (error) {
      console.error('Database error in findByEmail:', error);
      throw error;
    }
  },

  updateStatus: async (id, status) => {
    try {
      const query = "UPDATE subscriptions SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *";
      const values = [status, id];
      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('Database error in updateStatus:', error);
      throw error;
    }
  },

  // Check if specific plots are already reserved
  arePlotsReserved: async (plotIds) => {
    try {
      if (!plotIds || plotIds.length === 0) return [];
      
      // Handle both single plot ID and array of plot IDs
      const plotIdArray = Array.isArray(plotIds) ? plotIds : [plotIds];
      const placeholders = plotIdArray.map((_, index) => `$${index + 1}`).join(',');
      
      const query = `
        SELECT plot_id 
        FROM subscriptions 
        WHERE plot_id IN (${placeholders}) 
        AND status IN ('pending', 'approved')
      `;
      
      const result = await pool.query(query, plotIdArray);
      return result.rows.map(row => row.plot_id);
    } catch (error) {
      console.error('Database error in arePlotsReserved:', error);
      throw error;
    }
  },

  // Method to check if a single plot is reserved (for backward compatibility)
  isPlotReserved: async (plotId) => {
    try {
      const reserved = await Subscription.arePlotsReserved([plotId]);
      return reserved.length > 0;
    } catch (error) {
      console.error('Database error in isPlotReserved:', error);
      throw error;
    }
  }
};

module.exports = Subscription;