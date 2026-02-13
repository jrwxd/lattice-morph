
import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, Download, Grid3X3, Layers, Sliders, Image as ImageIcon, Box, Activity, Zap, Grid, Trash2, Plus } from 'lucide-react';
import { generateRandomPoints, computeVoronoi, relaxPoints, getAlternationIndex } from './utils/tessellation';

const App = () => {
    const [images, setImages] = useState([]);
    const [scale, setScale] = useState(12);
    const [gap, setGap] = useState(0.5);
    const [mode, setMode] = useState('hex'); // 'hex', 'tri', 'voronoi', 'stipple'
    const [pattern, setPattern] = useState('checkerboard'); // 'checkerboard', 'rows', 'cols', 'random'
    const [isProcessing, setIsProcessing] = useState(false);
    const [stippleIterations, setStippleIterations] = useState(0); // For progressive stippling

    const canvasRef = useRef(null);
    // We'll use a map or array of temporary canvases for pixel data extraction

    const SQRT3 = Math.sqrt(3);

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    setImages(prev => [...prev, { src: img, id: Date.now() }]);
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    };

    const removeImage = (id) => {
        setImages(prev => prev.filter(img => img.id !== id));
    };

    const drawHexagon = (ctx, x, y, size, color) => {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i + Math.PI / 6;
            ctx.lineTo(x + size * Math.cos(angle), y + size * Math.sin(angle));
        }
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
    };

    const drawTriangle = (ctx, x, y, size, color, inverted = false) => {
        ctx.beginPath();
        const angleOffset = inverted ? Math.PI : 0;
        for (let i = 0; i < 3; i++) {
            const angle = (Math.PI * 2 / 3) * i - Math.PI / 2 + angleOffset;
            ctx.lineTo(x + size * Math.cos(angle), y + size * Math.sin(angle));
        }
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
    };

    const renderScene = async () => {
        if (images.length === 0 || !canvasRef.current) return;
        setIsProcessing(true);

        // Use a small timeout to allow UI to update (show loading state)
        await new Promise(resolve => setTimeout(resolve, 10));

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        // Use the first image to define dimensions
        const primaryImg = images[0].src;
        const maxWidth = Math.min(window.innerWidth - 48, 1000);
        const aspect = primaryImg.height / primaryImg.width;
        const width = maxWidth;
        const height = maxWidth * aspect;

        canvas.width = width;
        canvas.height = height;

        // Prepare pixel data for ALL images
        // We resize all images to match the primary image's render dimensions
        const imagePixelData = [];

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width;
        tempCanvas.height = height;
        const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });

        for (const imgObj of images) {
            tempCtx.clearRect(0, 0, width, height);
            tempCtx.drawImage(imgObj.src, 0, 0, width, height);
            imagePixelData.push(tempCtx.getImageData(0, 0, width, height).data);
        }

        // Fill background
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, width, height);

        if (mode === 'voronoi' || mode === 'stipple') {
            // Voronoi / Stippling Logic
            const pointCount = mode === 'stipple' ? 2000 : Math.floor((width * height) / (scale * scale * 2));
            let points = generateRandomPoints(width, height, pointCount);

            // Relax points if stippling
            if (mode === 'stipple' && stippleIterations > 0) {
                let currentPoints = points;
                // Use the primary image (index 0) for density map for now, or blend?
                // Let's use image 0 for density.
                // Multi-image stippling is complex (whose density to use?). 
                // Creating a weighted map could work, but for now allow user to pick Alternation for COLOR.
                // Density will follow image 0.
                let voronoi;
                for (let i = 0; i < stippleIterations; i++) {
                    voronoi = computeVoronoi(currentPoints, width, height);
                    currentPoints = relaxPoints(voronoi, imagePixelData[0], width, height);
                }
                points = currentPoints;
            }

            const voronoi = computeVoronoi(points, width, height);

            // Draw cells
            for (let i = 0; i < points.length; i++) {
                const [x, y] = points[i];

                // Determine which image to sample from based on position + alternation
                // Using 'pixel' coordinates roughly mapped to a grid for alternation pattern consistency
                const colIdx = Math.floor(x / (scale * 2));
                const rowIdx = Math.floor(y / (scale * 2));

                const imgIdx = getAlternationIndex(colIdx, rowIdx, pattern, images.length);
                const pixels = imagePixelData[imgIdx];

                const sampleX = Math.max(0, Math.min(width - 1, Math.floor(x)));
                const sampleY = Math.max(0, Math.min(height - 1, Math.floor(y)));
                const idx = (sampleY * width + sampleX) * 4;
                const color = `rgb(${pixels[idx]},${pixels[idx + 1]},${pixels[idx + 2]})`;

                ctx.beginPath();
                if (mode === 'stipple') {
                    // Draw dots
                    // Size could be relative to brightness too? For now fixed or scale-based.
                    // For stippling, usually small dots.
                    const brightness = (pixels[idx] + pixels[idx + 1] + pixels[idx + 2]) / (3 * 255);
                    const dotSize = mode === 'stipple' ? Math.max(0.5, (1 - brightness) * (scale / 4)) : 1.5;
                    ctx.arc(x, y, dotSize, 0, Math.PI * 2);
                } else {
                    // Draw Voronoi cells
                    voronoi.renderCell(i, ctx);
                }
                ctx.fillStyle = color;
                if (mode !== 'stipple') ctx.fill();
                else ctx.fill();

                // Stroke for voronoi if gap > 0
                if (mode === 'voronoi' && gap > 0) {
                    ctx.lineWidth = gap;
                    ctx.strokeStyle = '#000';
                    ctx.stroke();
                }
            }

        } else {
            // Hex / Tri Logic
            const hSpacing = mode === 'hex' ? scale * SQRT3 : scale; // simplified for tri width
            const vSpacing = mode === 'hex' ? scale * 1.5 : scale * Math.sin(Math.PI / 3);

            if (mode === 'hex') {
                for (let row = -1; row < (height / vSpacing) + 1; row++) {
                    for (let col = -1; col < (width / hSpacing) + 1; col++) {
                        const x = col * hSpacing + (row % 2 === 0 ? 0 : hSpacing / 2);
                        const y = row * vSpacing;

                        const imgIdx = getAlternationIndex(col, row, pattern, images.length);
                        const pixels = imagePixelData[imgIdx];

                        const sampleX = Math.max(0, Math.min(width - 1, Math.floor(x)));
                        const sampleY = Math.max(0, Math.min(height - 1, Math.floor(y)));
                        const idx = (sampleY * width + sampleX) * 4;
                        const color = `rgb(${pixels[idx]},${pixels[idx + 1]},${pixels[idx + 2]})`;

                        drawHexagon(ctx, x, y, scale - gap, color);
                    }
                }
            } else {
                // Triangles
                const tHeight = scale * Math.sin(Math.PI / 3);
                const tWidth = scale;

                for (let y = 0; y < height + tHeight; y += tHeight) {
                    const row = Math.floor(y / tHeight);
                    for (let x = 0; x < width + tWidth; x += tWidth / 2) {
                        const col = Math.floor(x / (tWidth / 2));
                        const inverted = (row + col) % 2 !== 0;

                        const imgIdx = getAlternationIndex(col, row, pattern, images.length);
                        const pixels = imagePixelData[imgIdx];

                        const sampleX = Math.max(0, Math.min(width - 1, Math.floor(x)));
                        const sampleY = Math.max(0, Math.min(height - 1, Math.floor(y)));
                        const idx = (sampleY * width + sampleX) * 4;
                        const color = `rgb(${pixels[idx]},${pixels[idx + 1]},${pixels[idx + 2]})`;

                        drawTriangle(ctx, x, y, scale / SQRT3 + 0.5 - gap, color, inverted);
                    }
                }
            }
        }
        setIsProcessing(false);
    };

    useEffect(() => {
        const timeout = setTimeout(() => {
            renderScene();
        }, 50);
        return () => clearTimeout(timeout);
    }, [scale, gap, mode, images, pattern, stippleIterations]);

    const saveImage = () => {
        if (!canvasRef.current) return;
        const link = document.createElement('a');
        link.download = `morph-${mode}-${Date.now()}.png`;
        link.href = canvasRef.current.toDataURL();
        link.click();
    };

    return (
        <div className="min-h-screen bg-[#050505] text-zinc-300 font-mono p-6 flex flex-col items-center">
            {/* Header */}
            <div className="w-full max-w-6xl flex justify-between items-end mb-8 border-b border-zinc-800 pb-4">
                <div>
                    <h1 className="text-xl tracking-widest text-white uppercase font-bold">Lattice Morph</h1>
                    <p className="text-[10px] text-zinc-500 mt-1 uppercase tracking-widest">Multi-Source Tessellation // v3.0</p>
                </div>
                <div className="flex gap-2">
                    {[
                        { id: 'hex', icon: Box, label: 'Hex' },
                        { id: 'tri', icon: Grid3X3, label: 'Tri' },
                        { id: 'voronoi', icon: Activity, label: 'Vor' },
                        { id: 'stipple', icon: Zap, label: 'Stip' }
                    ].map(m => (
                        <button
                            key={m.id}
                            onClick={() => setMode(m.id)}
                            className={`flex flex-col items-center justify-center p-3 rounded w-16 transition-all ${mode === m.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-500'}`}
                        >
                            <m.icon size={18} />
                            <span className="text-[8px] uppercase mt-1 tracking-wider">{m.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Content Area */}
            <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-4 gap-8">

                {/* Left Sidebar: Controls */}
                <div className="lg:col-span-1 space-y-8 order-2 lg:order-1">

                    {/* Image Library */}
                    <div className="bg-zinc-900/50 p-4 rounded-lg border border-zinc-800">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-[10px] uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                                <ImageIcon size={12} /> Source Library
                            </h3>
                            <label className="cursor-pointer hover:text-indigo-400 transition-colors">
                                <Plus size={16} />
                                <input type="file" className="hidden" onChange={handleImageUpload} accept="image/*" />
                            </label>
                        </div>

                        <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto scrollbar-thin">
                            {images.map((img, idx) => (
                                <div key={img.id} className="relative group aspect-square rounded overflow-hidden border border-zinc-700 bg-black">
                                    <img src={img.src.src} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" />
                                    <button
                                        onClick={() => removeImage(img.id)}
                                        className="absolute top-1 right-1 bg-red-500/80 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <Trash2 size={10} />
                                    </button>
                                    <div className="absolute bottom-0 left-0 bg-black/60 text-[8px] px-1 text-white">
                                        SRC {idx + 1}
                                    </div>
                                </div>
                            ))}
                            {images.length === 0 && (
                                <div className="col-span-2 aspect-square border border-dashed border-zinc-800 rounded flex items-center justify-center">
                                    <span className="text-[10px] text-zinc-600">No Sources</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Parameters */}
                    <div className="bg-zinc-900/50 p-4 rounded-lg border border-zinc-800 space-y-6">
                        <div className="space-y-3">
                            <div className="flex justify-between text-[10px] uppercase tracking-widest text-zinc-500">
                                <label className="flex items-center gap-2"><Sliders size={12} /> Scale / Density</label>
                                <span>{scale}</span>
                            </div>
                            <input
                                type="range" min="4" max="80" value={scale}
                                onChange={(e) => setScale(Number(e.target.value))}
                                className="w-full appearance-none bg-zinc-800 h-1 rounded-full accent-indigo-500"
                            />
                        </div>

                        <div className="space-y-3">
                            <div className="flex justify-between text-[10px] uppercase tracking-widest text-zinc-500">
                                <label className="flex items-center gap-2"><Layers size={12} /> Gap Width</label>
                                <span>{gap}px</span>
                            </div>
                            <input
                                type="range" min="0" max="10" step="0.5" value={gap}
                                onChange={(e) => setGap(Number(e.target.value))}
                                className="w-full appearance-none bg-zinc-800 h-1 rounded-full accent-indigo-500"
                            />
                        </div>

                        {mode === 'stipple' && (
                            <div className="space-y-3">
                                <div className="flex justify-between text-[10px] uppercase tracking-widest text-zinc-500">
                                    <label className="flex items-center gap-2"><Activity size={12} /> Relax Iterations</label>
                                    <span>{stippleIterations}</span>
                                </div>
                                <input
                                    type="range" min="0" max="20" step="1" value={stippleIterations}
                                    onChange={(e) => setStippleIterations(Number(e.target.value))}
                                    className="w-full appearance-none bg-zinc-800 h-1 rounded-full accent-cyan-500"
                                />
                            </div>
                        )}
                    </div>

                    {/* Alternation Pattern */}
                    {images.length > 1 && (
                        <div className="bg-zinc-900/50 p-4 rounded-lg border border-zinc-800">
                            <h3 className="text-[10px] uppercase tracking-widest text-zinc-500 mb-3 flex items-center gap-2">
                                <Grid size={12} /> Alternation Logic
                            </h3>
                            <div className="grid grid-cols-2 gap-2">
                                {['checkerboard', 'rows', 'cols', 'random'].map(p => (
                                    <button
                                        key={p}
                                        onClick={() => setPattern(p)}
                                        className={`px-3 py-2 text-[10px] uppercase rounded border transition-all ${pattern === p ? 'bg-indigo-900/30 border-indigo-500 text-indigo-300' : 'bg-transparent border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}
                                    >
                                        {p}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <button
                        onClick={saveImage}
                        className="w-full py-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded text-xs uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 border border-zinc-700"
                    >
                        <Download size={16} /> Export
                    </button>

                </div>

                {/* Right Area: Canvas */}
                <div className="lg:col-span-3 order-1 lg:order-2">
                    <div className="relative w-full aspect-video bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 flex items-center justify-center group shadow-2xl">
                        {images.length === 0 ? (
                            <label className="cursor-pointer flex flex-col items-center gap-4 group animate-pulse">
                                <div className="w-20 h-20 rounded-full border border-dashed border-zinc-600 flex items-center justify-center group-hover:border-indigo-500 transition-colors">
                                    <Upload className="text-zinc-500 group-hover:text-indigo-500" size={32} />
                                </div>
                                <span className="text-xs text-zinc-500 uppercase tracking-widest">Add Source to Begin</span>
                                <input type="file" className="hidden" onChange={handleImageUpload} accept="image/*" />
                            </label>
                        ) : (
                            <canvas ref={canvasRef} className="max-h-full max-w-full object-contain" />
                        )}

                        {isProcessing && (
                            <div className="absolute top-4 right-4 bg-indigo-500/10 backdrop-blur text-indigo-300 text-[10px] px-3 py-1 rounded border border-indigo-500/30 animate-pulse uppercase tracking-wider flex items-center gap-2">
                                <Activity size={10} className="animate-spin" /> Processing
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <footer className="mt-12 text-[9px] text-zinc-700 uppercase tracking-[0.4em]">
                Lattice Morph V3 // Automated Tessellation System
            </footer>
        </div>
    );
};

export default App;
