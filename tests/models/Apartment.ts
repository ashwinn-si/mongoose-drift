import { Schema } from 'mongoose';

export const platformApartmentSchema = new Schema(
    {
        clientId: {
            type: Schema.Types.ObjectId,
            ref: 'clients',
            required: true,
            index: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
        },
        clientDbApartmentRef: {
            type: String,
            required: true,
            trim: true,
        },
        allowedFlatCount: {
            type: Number,
            required: true,
            min: 0,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
    }
);
