import mongoose from 'mongoose';

const addressSchema = new mongoose.Schema({
  street: { type: String, required: true },
  city: { type: String, required: true },
  zip: { type: String, required: true },
  country: { type: String, default: 'India' },
});

const rentSchema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
  amount: { type: Number, required: true, index: true },
  currency: { type: String, enum: ['INR', 'USD', 'EUR'], default: 'INR' },
  status: { type: String, enum: ['pending', 'paid', 'overdue', 'cancelled'], default: 'pending' },
  dueDate: { type: Date, required: true },
  paidAt: Date,
  address: addressSchema,
  tags: [String],
  paymentHistory: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Payment' }],
  notes: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
  metadata: { type: mongoose.Schema.Types.Mixed },
});

rentSchema.index({ tenant: 1, dueDate: -1 });
rentSchema.index({ status: 1, isActive: 1 }, { sparse: true });
rentSchema.index({ amount: 1 }, { unique: false, name: 'amount_idx' });

export const Rent = mongoose.model('Rent', rentSchema);
