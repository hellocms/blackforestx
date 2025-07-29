const mongoose = require('mongoose');

const CategorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null }, // Optional parent category
  image: { type: String, default: null }, // Single image filename
  isPastryProduct: { type: Boolean, default: false }, // Pastry product flag
  isCake: { type: Boolean, default: false }, // New field for cake flag
  isBiling: { type: Boolean, default: false }, // New field for biling flag
}, { timestamps: true });

module.exports = mongoose.model('Category', CategorySchema);