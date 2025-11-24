import React, { useState, useEffect } from 'react';
import { Upload, Image as ImageIcon, Sparkles, Download, Settings, RefreshCw, Layers, Loader2, X, AlertCircle, CheckCircle2, ScanSearch, Copy, Move, Eraser, Wand2 } from 'lucide-react';

const InstaCreator = () => {
  // --- KONFIGURACJA ---
  let defaultApiKey = '';
  try {
    if (import.meta && import.meta.env) {
      defaultApiKey = import.meta.env.VITE_GOOGLE_API_KEY || '';
    }
  } catch (e) { console.warn('Preview mode'); }
  
  const [apiKey, setApiKey] = useState(defaultApiKey);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Stany procesu
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatorSource, setGeneratorSource] = useState('google'); // 'google' | 'pollinations'
  
  // Dane wyjściowe
  const [backgroundImage, setBackgroundImage] = useState(null); 
  const [analysisResult, setAnalysisResult] = useState(null);
  const [postCaption, setPostCaption] = useState('');
  
  // Ustawienia kompozycji
  const [productScale, setProductScale] = useState(70);
  const [productY, setProductY] = useState(50);
  const [removeWhiteBg, setRemoveWhiteBg] = useState(true); 
  
  const [prompt, setPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('minimalist');
  const [errorMsg, setErrorMsg] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    if (defaultApiKey && !apiKey) setApiKey(defaultApiKey);
  }, [defaultApiKey]);

  const styles = [
    { 
      id: 'minimalist', 
      name: 'Clean Desk', 
      prompt: 'top down view of a clean white desk, empty center area, soft natural window lighting, minimalist aesthetic, high quality texture, 8k', 
      color: 'bg-gray-100' 
    },
    { 
      id: 'warm', 
      name: 'Cozy Wood', 
      prompt: 'top down view of a wooden table surface, warm cozy atmosphere, soft morning sunlight, blurred coffee cup in corner, empty center, lifestyle photography', 
      color: 'bg-orange-50' 
    },
    { 
      id: 'concrete', 
      name: 'Urban Concrete', 
      prompt: 'top down view of grey concrete surface, sharp texture, modern minimalist shadow, harsh lighting, empty center for product placement', 
      color: 'bg-slate-200' 
    },
    { 
      id: 'nature', 
      name: 'Botanical', 
      prompt: 'flatlay background with green eucalyptus leaves on edges, white stone surface, soft shadows, organic feel, empty center, bright lighting', 
      color: 'bg-green-100' 
    },
    { 
      id: 'dark', 
      name: 'Elegant Dark', 
      prompt: 'dark black matte texture background, dramatic spotlight, elegant shadows, premium luxury feel, gold dust accents on edges, empty center', 
      color: 'bg-slate-800 text-white' 
    },
    { 
      id: 'marble', 
      name: 'Marble Luxury', 
      prompt: 'white carrara marble surface background, expensive look, soft reflections, bright studio lighting, empty center', 
      color: 'bg-purple-100' 
    },
  ];

  const handleFile = (file) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target.result;
        setUploadedImage(base64);
        setBackgroundImage(null);
        setAnalysisResult(null);
        setPostCaption('');
        setErrorMsg('');
        
        // Tymczasowe tło
        setBackgroundImage('https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=2029&auto=format&fit=crop');

        analyzeProduct(base64, apiKey || defaultApiKey);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e) => { e.preventDefault(); setIsDragging(false); const file = e.dataTransfer.files[0]; handleFile(file); };
  const handleFileInput = (e) => { const file = e.target.files[0]; handleFile(file); };

  // --- 1. ANALIZA (OCR/GEMINI) ---
  const analyzeProduct = async (imageBase64, key) => {
    if (!key) return;
    setIsAnalyzing(true);
    try {
      const base64Data = imageBase64.split(',')[1]; 
      const mimeType = imageBase64.split(';')[0].split(':')[1];

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: `Jesteś ekspertem social media marki 'notato.pl'. 
              Przeanalizuj zdjęcie produktu.
              1. Zaproponuj styl tła z listy (Clean Desk, Cozy Wood, Urban Concrete, Botanical, Elegant Dark, Marble Luxury) pasujący do produktu.
              2. Napisz krótki, angażujący post na Instagram po polsku (użyj emoji).
              
              Zwróć TYLKO czysty JSON bez markdown: { "suggestedStyle": "style name", "instagramCaption": "text..." }` },
              { inlineData: { mimeType: mimeType, data: base64Data } }
            ]
          }]
        })
      });

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        const jsonStr = text.replace(/```json|```/g, '').trim();
        const analysis = JSON.parse(jsonStr);
        setAnalysisResult(analysis);
        setPostCaption(analysis.instagramCaption);
        const matched = styles.find(s => s.name.toLowerCase().includes(analysis.suggestedStyle.toLowerCase()));
        if (matched) setSelectedStyle(matched.id);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // --- 2. GENEROWANIE TŁA (GOOGLE IMAGEN / POLLINATIONS FALLBACK) ---
  const handleGenerateBackground = async () => {
    setIsGenerating(true);
    setErrorMsg('');
    setGeneratorSource('google'); // Próbujemy Google najpierw

    const styleObj = styles.find(s => s.id === selectedStyle);
    // Kluczowe dla Google Imagen: Prosimy o tło, podkreślamy pusty środek
    const bgPrompt = `Top down view background texture only, ${styleObj?.prompt}, empty center area, no objects in center, photorealistic, 8k. ${prompt}`;

    try {
      const activeKey = apiKey || defaultApiKey;
      let imageUrl = null;

      // KROK A: Próba użycia Google Imagen 3
      if (activeKey) {
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${activeKey}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                instances: [{ prompt: bgPrompt }],
                parameters: { sampleCount: 1, aspectRatio: "1:1" }
              })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.predictions?.[0]?.bytesBase64Encoded) {
                    imageUrl = `data:image/png;base64,${data.predictions[0].bytesBase64Encoded}`;
                }
            } else {
                console.warn("Google Imagen niedostępny/błąd, przełączanie na zapasowy...");
                throw new Error("Imagen fail"); 
            }
        } catch (err) {
            // Jeśli Google zawiedzie (404/403), lecimy do Kroku B
            setGeneratorSource('pollinations');
        }
      } else {
         setGeneratorSource('pollinations');
      }

      // KROK B: Fallback do Pollinations (gdy brak klucza lub błąd Google)
      if (!imageUrl) {
          const seed = Math.floor(Math.random() * 1000000);
          const encodedPrompt = encodeURIComponent(bgPrompt);
          imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?seed=${seed}&width=1080&height=1080&nologo=true&model=flux&enhance=false`;
      }

      // KROK C: Ładowanie obrazu
      const img = new Image();
      img.src = imageUrl;
      img.onload = () => { setBackgroundImage(imageUrl); setIsGenerating(false); };
      img.onerror = () => { throw new Error("Błąd ładowania obrazu."); };

    } catch (error) {
      setErrorMsg(`Błąd: ${error.message}`);
      setIsGenerating(false);
    }
  };

  // --- 3. KOMPOZYCJA (ZACHOWANIE ORYGINAŁU) ---
  const handleDownloadComposite = () => {
    if (!uploadedImage || !backgroundImage) return;

    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d');

    const bgImg = new Image();
    bgImg.crossOrigin = "anonymous"; // Ważne dla zewnętrznych obrazów
    bgImg.src = backgroundImage;

    bgImg.onload = () => {
      // Rysuj tło
      ctx.drawImage(bgImg, 0, 0, 1080, 1080);

      const prodImg = new Image();
      prodImg.src = uploadedImage;
      prodImg.onload = () => {
        // Skalowanie i pozycja
        const scale = productScale / 100;
        const w = 1080 * scale; 
        const ratio = prodImg.width / prodImg.height;
        const drawH = w / ratio; 
        
        const x = (1080 - w) / 2;
        const y = (1080 * (productY / 100)) - (drawH / 2);

        // Tryb mieszania (usuwanie białego tła)
        if (removeWhiteBg) {
            ctx.globalCompositeOperation = 'multiply';
        }

        ctx.drawImage(prodImg, x, y, w, drawH);
        ctx.globalCompositeOperation = 'source-over';

        const link = document.createElement('a');
        link.download = `notato-post-${Date.now()}.jpg`;
        link.href = canvas.toDataURL('image/jpeg', 0.9);
        link.click();
      };
    };
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-purple-200">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-slate-900 p-2 rounded-lg text-white">
              <Layers size={20} />
            </div>
            <h1 className="text-xl font-bold text-slate-900">notato<span className="text-purple-600">.AI</span> <span className="text-xs font-normal text-slate-400 ml-1">Studio</span></h1>
          </div>
          <div className="flex items-center gap-3">
             <button onClick={() => setShowApiKey(!showApiKey)} className="p-2 hover:bg-slate-100 rounded-full"><Settings size={18} /></button>
          </div>
        </div>
        {showApiKey && (
          <div className="bg-slate-100 border-b border-slate-200 p-4">
            <div className="max-w-6xl mx-auto flex gap-4">
              <input type="password" placeholder="Klucz Google Gemini API..." className="flex-1 px-4 py-2 rounded-md border" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
              <button onClick={() => setShowApiKey(false)} className="px-4 py-2 bg-slate-800 text-white rounded-md">Zapisz</button>
            </div>
          </div>
        )}
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEWA KOLUMNA - KONFIGURACJA */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* 1. Upload */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
             <h2 className="font-semibold text-slate-700 mb-4 flex items-center gap-2"><ScanSearch size={18} className="text-purple-600"/> 1. Produkt</h2>
             {!uploadedImage ? (
                <div 
                  onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl h-40 flex flex-col items-center justify-center transition-all cursor-pointer ${isDragging ? 'border-purple-500 bg-purple-50' : 'border-slate-200 hover:bg-slate-50'}`}
                >
                  <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer">
                    <Upload className="text-slate-400 mb-2" size={24} />
                    <span className="text-sm font-medium text-slate-600">Wgraj Packshot</span>
                    <input type="file" className="hidden" accept="image/*" onChange={handleFileInput} />
                  </label>
                </div>
             ) : (
                <div className="relative rounded-lg overflow-hidden border border-slate-200">
                   <img src={uploadedImage} className="h-40 w-full object-contain bg-checkerboard" alt="preview"/>
                   <button onClick={() => setUploadedImage(null)} className="absolute top-1 right-1 bg-white p-1 rounded-full shadow hover:text-red-500"><X size={14}/></button>
                   {isAnalyzing && <div className="absolute inset-0 bg-white/80 flex items-center justify-center text-xs font-medium text-purple-600"><Loader2 className="animate-spin mr-1" size={12}/> Analiza AI...</div>}
                </div>
             )}
          </div>

          {/* 2. Styl Tła */}
          <div className={`bg-white rounded-2xl shadow-sm border border-slate-100 p-4 transition-opacity ${!uploadedImage ? 'opacity-50 pointer-events-none' : ''}`}>
             <h2 className="font-semibold text-slate-700 mb-4 flex items-center gap-2"><Wand2 size={18} className="text-purple-600"/> 2. Styl Tła</h2>
             <div className="grid grid-cols-2 gap-2 mb-4">
                {styles.map(s => (
                   <button key={s.id} onClick={() => setSelectedStyle(s.id)} className={`p-2 text-xs rounded-lg border text-left flex items-center gap-2 ${selectedStyle === s.id ? 'border-purple-500 bg-purple-50' : 'border-slate-100'}`}>
                      <div className={`w-3 h-3 rounded-full ${s.color}`}></div> {s.name}
                   </button>
                ))}
             </div>
             <button onClick={handleGenerateBackground} disabled={isGenerating} className="w-full py-3 bg-slate-900 text-white rounded-lg text-sm font-medium shadow-lg hover:bg-slate-800 flex justify-center items-center gap-2">
                {isGenerating ? <Loader2 className="animate-spin" size={16}/> : <RefreshCw size={16}/>}
                {backgroundImage ? 'Generuj Nowe Tło' : 'Generuj Tło'}
             </button>
             {generatorSource === 'pollinations' && backgroundImage && !isGenerating && (
                 <div className="mt-2 text-[10px] text-amber-600 bg-amber-50 p-2 rounded border border-amber-100 flex gap-2">
                     <AlertCircle size={12} className="shrink-0 mt-0.5"/>
                     Twoje klucz API Google nie obsługuje jeszcze generowania obrazów (Błąd 404). Użyto zapasowego generatora.
                 </div>
             )}
          </div>

          {/* 3. Dopasowanie */}
          {uploadedImage && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
               <h2 className="font-semibold text-slate-700 mb-4 flex items-center gap-2"><Move size={18} className="text-purple-600"/> 3. Dopasuj Produkt</h2>
               
               <div className="space-y-4">
                  <div>
                    <label className="text-xs text-slate-500 flex justify-between mb-1">Wielkość <span>{productScale}%</span></label>
                    <input type="range" min="10" max="150" value={productScale} onChange={e=>setProductScale(Number(e.target.value))} className="w-full accent-purple-600 h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer"/>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 flex justify-between mb-1">Pozycja Pionowa</label>
                    <input type="range" min="0" max="100" value={productY} onChange={e=>setProductY(Number(e.target.value))} className="w-full accent-purple-600 h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer"/>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                     <span className="text-sm text-slate-700 flex items-center gap-2"><Eraser size={16}/> Usuń białe tło</span>
                     <button 
                        onClick={() => setRemoveWhiteBg(!removeWhiteBg)}
                        className={`w-10 h-6 rounded-full transition-colors relative ${removeWhiteBg ? 'bg-purple-600' : 'bg-slate-300'}`}
                     >
                        <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${removeWhiteBg ? 'left-5' : 'left-1'}`}></div>
                     </button>
                  </div>
               </div>
            </div>
          )}
        </div>

        {/* PRAWA KOLUMNA - STUDIO (PODGLĄD) */}
        <div className="lg:col-span-8">
           <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden h-full flex flex-col">
              <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                 <h2 className="font-semibold text-slate-700 flex items-center gap-2">
                     <ImageIcon size={18} className="text-purple-600"/> Studio 
                     {generatorSource === 'google' && backgroundImage && <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full ml-2">Powered by Google Imagen</span>}
                 </h2>
                 <button onClick={handleDownloadComposite} className="text-xs bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 font-medium flex gap-2"><Download size={14}/> Pobierz Gotowe</button>
              </div>
              
              <div className="flex-1 bg-slate-100 relative flex items-center justify-center overflow-hidden p-8 min-h-[500px]">
                 
                 {/* CANVAS AREA */}
                 <div className="relative w-full max-w-[500px] aspect-square bg-white shadow-2xl rounded-sm overflow-hidden group">
                    {/* WARSTWA 1: TŁO */}
                    {backgroundImage ? (
                       <img src={backgroundImage} className="absolute inset-0 w-full h-full object-cover" alt="background" />
                    ) : (
                       <div className="absolute inset-0 bg-slate-50 flex items-center justify-center text-slate-300">
                          <ImageIcon size={48} />
                       </div>
                    )}

                    {/* WARSTWA 2: PRODUKT */}
                    {uploadedImage && (
                       <img 
                          src={uploadedImage} 
                          alt="product"
                          className="absolute transition-all duration-75 select-none"
                          style={{
                             width: `${productScale}%`,
                             left: '50%',
                             top: `${productY}%`,
                             transform: 'translate(-50%, -50%)',
                             mixBlendMode: removeWhiteBg ? 'multiply' : 'normal'
                          }} 
                       />
                    )}

                    {/* Overlay Grid */}
                    <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-10 transition-opacity">
                       <div className="w-full h-full border border-slate-900 grid grid-cols-3 grid-rows-3">
                          {[...Array(9)].map((_,i) => <div key={i} className="border border-slate-500/20"></div>)}
                       </div>
                    </div>
                 </div>
              </div>

              {/* Sekcja Copywritingu */}
              {postCaption && (
                 <div className="p-4 bg-white border-t border-slate-100">
                    <div className="flex justify-between items-center mb-2">
                       <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Sugerowany Opis</span>
                       <button onClick={() => {navigator.clipboard.writeText(postCaption); alert('Skopiowano!')}} className="text-purple-600 hover:text-purple-800"><Copy size={16}/></button>
                    </div>
                    <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">{postCaption}</p>
                 </div>
              )}
           </div>
        </div>
      </main>
    </div>
  );
};

export default InstaCreator;