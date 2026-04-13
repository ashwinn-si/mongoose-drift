import mongoose from 'mongoose';

const amenitySchema = new mongoose.Schema({
  name: { type: String, required: true },
  available: { type: Boolean, default: true },
});

const propertySchema = new mongoose.Schema({
  title: { type: String, required: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['apartment', 'house', 'commercial', 'land'], required: true },
  bedrooms: { type: Number, default: 0 },
  bathrooms: { type: Number, default: 0 },
  area: { type: Number, required: true },
  price: { type: Number, required: true, index: true },
  location: {
    lat: { type: Number },
    lng: { type: Number },
  },
  amenities: [amenitySchema],
  images: [String],
  listedAt: { type: Date, default: Date.now },
  isPublished: { type: Boolean, default: false },
});

propertySchema.index({ owner: 1, type: 1 });
propertySchema.index({ price: 1, area: 1 });

export const Property = mongoose.model('Property', propertySchema);
