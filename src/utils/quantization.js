
import quantize from 'quantize';

/**
 * Quantizes an array of pixel data to a limited palette.
 * @param {Uint8ClampedArray} pixelData - RGBA pixel data
 * @param {number} colorCount - Maximum number of colors (must be > 1)
 * @returns {Uint8ClampedArray} - New pixel data with quantized colors
 */
export const quantizeImage = (pixelData, colorCount) => {
    if (colorCount < 2 || colorCount > 256) return pixelData;

    // 1. Extract pixels for quantization (ignoring alpha for now or handling it)
    // quantize lib expects array of [r, g, b]
    const pixels = [];
    for (let i = 0; i < pixelData.length; i += 4) {
        // Simple optimization: skip transparent pixels or sample every Nth pixel for speed?
        // For accurate palette, we should sample enough.
        // Let's sample every 10th pixel for performance if image is large, else all.
        // For now, let's try sampling all or a subset.
        if (pixelData[i + 3] < 128) continue; // Ignore transparent
        pixels.push([pixelData[i], pixelData[i + 1], pixelData[i + 2]]);
    }

    // If not enough pixels, return original
    if (pixels.length === 0) return pixelData;

    // Optimized sampling for speed: max 5000 pixels
    const maxSamples = 5000;
    let samplePixels = pixels;
    if (pixels.length > maxSamples) {
        samplePixels = [];
        const step = Math.floor(pixels.length / maxSamples);
        for (let i = 0; i < pixels.length; i += step) {
            samplePixels.push(pixels[i]);
        }
    }

    // 2. Generate Palette
    const colorMap = quantize(samplePixels, colorCount);
    if (!colorMap) return pixelData;

    // palette is array of [r, g, b]
    const palette = colorMap.palette();

    // 3. Map original pixels to nearest palette color
    // Determine nearest color (Euclidean distance)
    // Could cache mapping if colors repeat often, but for now simple loop.

    const newPixelData = new Uint8ClampedArray(pixelData.length);

    // We can build a lookup table if the input image has limited colors, but it usually doesn't.
    // For 256 colors, simple distance check is okayish for small images, but slow for 4k.
    // Optimization: Render Loop will do the actual drawing. 
    // Maybe we just return the Palette and a function to map?
    // Or we modify the data in place? 
    // Let's return a map lookup function? No, `renderScene` needs pixel data.
    // Let's map it.

    for (let i = 0; i < pixelData.length; i += 4) {
        if (pixelData[i + 3] === 0) {
            newPixelData[i] = 0;
            newPixelData[i + 1] = 0;
            newPixelData[i + 2] = 0;
            newPixelData[i + 3] = 0;
            continue;
        }

        const r = pixelData[i];
        const g = pixelData[i + 1];
        const b = pixelData[i + 2];

        // Find nearest in palette
        let minDist = Infinity;
        let pColor = palette[0];

        for (const color of palette) {
            const dr = r - color[0];
            const dg = g - color[1];
            const db = b - color[2];
            const dist = dr * dr + dg * dg + db * db;
            if (dist < minDist) {
                minDist = dist;
                pColor = color;
            }
        }

        newPixelData[i] = pColor[0];
        newPixelData[i + 1] = pColor[1];
        newPixelData[i + 2] = pColor[2];
        newPixelData[i + 3] = pixelData[i + 3]; // Keep alpha
    }

    return newPixelData;
};
