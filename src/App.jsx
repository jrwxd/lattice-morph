import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, Download, Grid3X3, Layers, Sliders, Image as ImageIcon, Box } from 'lucide-react';

const App = () => {
    const [image, setImage] = useState(null);
    const [scale, setScale] = useState(12);
    const [gap, setGap] = useState(0.5);
    const [mode, setMode] = useState('hex'); // 'hex' or 'tri'
    const [isProcessing, setIsProcessing] = useState(false);
    const canvasRef = useRef(null);
    const sourceCanvasRef = useRef(null);

    // Constants for geometry
    const SQRT3 = Math.sqrt(3);

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    setImage(img);
                    renderLattice(img, scale, gap, mode);
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    };

    const drawHexagon = (ctx, x, y, size, color) => {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i + Math.PI / 6; // Pointy topped
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

    const renderLattice = (img, s, g, currentMode) => {
        if (!img || !canvasRef.current) return;
        setIsProcessing(true);

        const canvas = canvasRef.current;
        const sCanvas = sourceCanvasRef.current;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const sCtx = sCanvas.getContext('2d', { willReadFrequently: true });

        // Handle responsiveness
        const maxWidth = Math.min(window.innerWidth - 48, 1000);
        const aspect = img.height / img.width;
        const width = maxWidth;
        const height = maxWidth * aspect;

        canvas.width = width;
        canvas.height = height;
        sCanvas.width = width;
        sCanvas.height = height;

        sCtx.drawImage(img, 0, 0, width, height);
        const pixels = sCtx.getImageData(0, 0, width, height).data;

        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, width, height);

        if (currentMode === 'hex') {
            // Hexagons on a triangular grid of centers
            const hSpacing = s * SQRT3;
            const vSpacing = s * 1.5;

            for (let row = -1; row < (height / vSpacing) + 1; row++) {
                for (let col = -1; col < (width / hSpacing) + 1; col++) {
                    const x = col * hSpacing + (row % 2 === 0 ? 0 : hSpacing / 2);
                    const y = row * vSpacing;

                    const sampleX = Math.max(0, Math.min(width - 1, Math.floor(x)));
                    const sampleY = Math.max(0, Math.min(height - 1, Math.floor(y)));
                    const idx = (sampleY * width + sampleX) * 4;
                    const color = `rgb(${pixels[idx]},${pixels[idx + 1]},${pixels[idx + 2]})`;

                    drawHexagon(ctx, x, y, s - g, color);
                }
            }
        } else {
            // Triangular lattice (Triangles filling the space)
            const tHeight = s * Math.sin(Math.PI / 3);
            const tWidth = s;

            for (let y = 0; y < height + tHeight; y += tHeight) {
                const row = Math.floor(y / tHeight);
                for (let x = 0; x < width + tWidth; x += tWidth / 2) {
                    const col = Math.floor(x / (tWidth / 2));
                    const inverted = (row + col) % 2 !== 0;

                    const sampleX = Math.max(0, Math.min(width - 1, Math.floor(x)));
                    const sampleY = Math.max(0, Math.min(height - 1, Math.floor(y)));
                    const idx = (sampleY * width + sampleX) * 4;
                    const color = `rgb(${pixels[idx]},${pixels[idx + 1]},${pixels[idx + 2]})`;

                    drawTriangle(ctx, x, y, s / SQRT3 + 0.5 - g, color, inverted);
                }
            }
        }
        setIsProcessing(false);
    };

    useEffect(() => {
        const timeout = setTimeout(() => {
            if (image) renderLattice(image, scale, gap, mode);
        }, 50);
        return () => clearTimeout(timeout);
    }, [scale, gap, mode, image]);

    const saveImage = () => {
        const link = document.createElement('a');
        link.download = `lattice-${mode}-${Date.now()}.png`;
        link.href = canvasRef.current.toDataURL();
        link.click();
    };

    return (
        <div className="min-h-screen bg-[#050505] text-zinc-300 font-mono p-6 flex flex-col items-center">
            {/* Header */}
            <div className="w-full max-w-4xl flex justify-between items-end mb-8 border-b border-zinc-800 pb-4">
                <div>
                    <h1 className="text-xl tracking-widest text-white uppercase font-bold">Lattice Morph</h1>
                    <p className="text-[10px] text-zinc-500 mt-1 uppercase tracking-widest">Procedural Reconstruction // v2.0</p>
                </div>
                <div className="flex gap-4">
                    <button
                        onClick={() => setMode('hex')}
                        className={`p-2 rounded transition-all ${mode === 'hex' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'hover:bg-zinc-800 text-zinc-500'}`}
                    >
                        <Box size={20} />
                    </button>
                    <button
                        onClick={() => setMode('tri')}
                        className={`p-2 rounded transition-all ${mode === 'tri' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'hover:bg-zinc-800 text-zinc-500'}`}
                    >
                        <Grid3X3 size={20} />
                    </button>
                </div>
            </div>

            {/* Main Viewport */}
            <div className="relative w-full max-w-4xl aspect-video bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 flex items-center justify-center group">
                {!image ? (
                    <label className="cursor-pointer flex flex-col items-center gap-4 group">
                        <div className="w-16 h-16 rounded-full border border-dashed border-zinc-700 flex items-center justify-center group-hover:border-indigo-500 transition-colors">
                            <Upload className="text-zinc-600 group-hover:text-indigo-500" />
                        </div>
                        <span className="text-xs text-zinc-500 uppercase tracking-widest">Inject Source Material</span>
                        <input type="file" className="hidden" onChange={handleImageUpload} accept="image/*" />
                    </label>
                ) : (
                    <canvas ref={canvasRef} className="max-h-full max-w-full object-contain cursor-crosshair" />
                )}

                <canvas ref={sourceCanvasRef} className="hidden" />

                {isProcessing && (
                    <div className="absolute top-4 right-4 bg-black/80 text-[10px] px-3 py-1 rounded-full border border-zinc-700 animate-pulse uppercase tracking-tighter">
                        Calculating Tessellation...
                    </div>
                )}
            </div>

            {/* Control Panel */}
            {image && (
                <div className="w-full max-w-4xl mt-8 grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
                    <div className="space-y-6">
                        <div className="space-y-3">
                            <div className="flex justify-between text-[10px] uppercase tracking-widest text-zinc-500">
                                <label className="flex items-center gap-2"><Sliders size={12} /> Lattice Scale</label>
                                <span>{scale}px</span>
                            </div>
                            <input
                                type="range" min="4" max="60" value={scale}
                                onChange={(e) => setScale(Number(e.target.value))}
                                className="w-full appearance-none bg-zinc-800 h-1 rounded-full accent-indigo-500"
                            />
                        </div>
                        <div className="space-y-3">
                            <div className="flex justify-between text-[10px] uppercase tracking-widest text-zinc-500">
                                <label className="flex items-center gap-2"><Layers size={12} /> Void Gap</label>
                                <span>{gap}px</span>
                            </div>
                            <input
                                type="range" min="0" max="10" step="0.5" value={gap}
                                onChange={(e) => setGap(Number(e.target.value))}
                                className="w-full appearance-none bg-zinc-800 h-1 rounded-full accent-indigo-500"
                            />
                        </div>
                    </div>

                    <div className="md:col-span-2 flex flex-col md:flex-row gap-4 justify-end h-full py-4">
                        <button
                            onClick={saveImage}
                            className="px-8 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded text-xs uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 border border-zinc-700"
                        >
                            <Download size={16} /> Export Composition
                        </button>
                        <label className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 cursor-pointer shadow-xl shadow-indigo-600/10">
                            <ImageIcon size={16} /> Change Source
                            <input type="file" className="hidden" onChange={handleImageUpload} accept="image/*" />
                        </label>
                    </div>
                </div>
            )}

            <footer className="mt-auto pt-12 pb-4 text-[9px] text-zinc-700 uppercase tracking-[0.4em]">
                Data // Order // Poetry
            </footer>
        </div>
    );
};

export default App;
