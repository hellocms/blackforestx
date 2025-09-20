const Inventory = require('../models/Inventory');
const Product = require('../models/Products');
const Branch = require('../models/Branch');

// Existing functions...
exports.produceStock = async (req, res) => {
  try {
    const { productId, quantity, reason } = req.body;
    if (!productId || !quantity) return res.status(400).json({ message: 'Product ID and quantity required' });

    let inventory = await Inventory.findOne({ productId, locationId: null });
    if (!inventory) {
      inventory = new Inventory({ productId, locationId: null, inStock: 0 });
    }

    inventory.inStock += Number(quantity);
    inventory.stockHistory.push({ change: Number(quantity), reason: reason || 'Factory Production' });
    await inventory.save();

    res.status(200).json({ message: 'Stock produced successfully', inventory });
  } catch (error) {
    console.error('❌ Error producing stock:', error);
    res.status(500).json({ message: 'Error producing stock', error: error.message });
  }
};

exports.getInventory = async (req, res) => {
  try {
    const { locationId } = req.query;
    const query = {};
    if (locationId === 'null') query.locationId = null;
    else if (locationId) query.locationId = locationId;

    const inventory = await Inventory.find(query)
      .populate('productId', 'productId name isVeg category priceDetails productType')
      .populate({ path: 'productId', populate: { path: 'category', select: 'name' } });
    res.status(200).json(inventory);
  } catch (error) {
    console.error('❌ Error fetching inventory:', error);
    res.status(500).json({ message: 'Error fetching inventory', error: error.message });
  }
};

exports.updateStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { inStock, reason } = req.body;

    const inventory = await Inventory.findById(id);
    if (!inventory) return res.status(404).json({ message: 'Inventory record not found' });

    const oldStock = inventory.inStock;
    const newStock = inStock !== undefined ? Number(inStock) : oldStock;
    const stockChange = newStock - oldStock;

    if (stockChange !== 0) {
      inventory.stockHistory.push({
        date: new Date(),
        change: stockChange,
        reason: reason || 'Manual Update',
      });
    }

    inventory.inStock = newStock;
    await inventory.save();

    res.status(200).json({ message: 'Stock updated successfully', inventory });
  } catch (error) {
    console.error('❌ Error updating stock:', error);
    res.status(500).json({ message: 'Error updating stock', error: error.message });
  }
};

exports.updateThreshold = async (req, res) => {
  try {
    const { id } = req.params;
    const { lowStockThreshold } = req.body;

    const inventory = await Inventory.findById(id);
    if (!inventory) return res.status(404).json({ message: 'Inventory record not found' });

    inventory.lowStockThreshold = lowStockThreshold !== undefined ? Number(lowStockThreshold) : inventory.lowStockThreshold;
    await inventory.save();

    res.status(200).json({ message: 'Threshold updated successfully', inventory });
  } catch (error) {
    console.error('❌ Error updating threshold:', error);
    res.status(500).json({ message: 'Error updating threshold', error: error.message });
  }
};

exports.getBranches = async (req, res) => {
  try {
    const branches = await Branch.find({}, 'name');
    res.status(200).json(branches);
  } catch (error) {
    console.error('❌ Error fetching branches:', error);
    res.status(500).json({ message: 'Error fetching branches', error: error.message });
  }
};

// Add reduceStock function
exports.reduceStock = async (branchId, products) => {
  try {
    for (const product of products) {
      const { productId, quantity } = product;

      let inventory = await Inventory.findOne({
        productId,
        locationId: branchId,
      });

      if (inventory) {
        const newStock = Math.max(0, inventory.inStock - Number(quantity));
        await Inventory.updateOne(
          { _id: inventory._id },
          {
            $set: { inStock: newStock },
            $push: {
              stockHistory: {
                change: -Number(quantity),
                reason: 'Sale',
                date: new Date(),
              },
            },
          }
        );
      } else {
        inventory = new Inventory({
          productId,
          locationId: branchId,
          inStock: 0,
          lowStockThreshold: 5,
          stockHistory: [{
            change: -Number(quantity),
            reason: 'Sale - Initial',
            date: new Date(),
          }],
        });
        await inventory.save();
      }
    }
  } catch (error) {
    console.error('❌ Error reducing stock:', error);
    throw new Error('Failed to reduce stock');
  }
};

// Add reduceStockEndpoint
exports.reduceStockEndpoint = async (req, res) => {
  const { branchId, products } = req.body;

  if (!branchId || !products || !Array.isArray(products)) {
    return res.status(400).json({ message: 'Invalid request data' });
  }

  try {
    await exports.reduceStock(branchId, products);
    res.status(200).json({ message: 'Stock reduced successfully' });
  } catch (error) {
    console.error('❌ Error in reduceStockEndpoint:', error);
    res.status(500).json({ message: 'Error reducing stock', error: error.message });
  }
};

module.exports = {
  produceStock: exports.produceStock,
  getInventory: exports.getInventory,
  updateStock: exports.updateStock,
  updateThreshold: exports.updateThreshold,
  getBranches: exports.getBranches,
  reduceStock: exports.reduceStock,        // Ensure this is exported
  reduceStockEndpoint: exports.reduceStockEndpoint,
};