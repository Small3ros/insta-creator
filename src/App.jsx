import React, { useState, useEffect } from 'react';
import { Upload, Image as ImageIcon, Sparkles, Download, Settings, RefreshCw, Share2, Instagram, Wand2, Layers, Loader2, X, AlertCircle, CheckCircle2 } from 'lucide-react';

const InstaCreator = () => {
  // W środowisku produkcyjnym (Vite/Netlify) odkomentuj poniższą linię, aby pobierać klucz z .env:
  // const defaultApiKey = import.meta.env?.VITE_GOOGLE_API_KEY || '';
  
  // Dla celów tego podglądu ustawiamy domyślnie pusty klucz:
  const defaultApiKey = '';
  
  const [apiKey, setApiKey] = useState(defaultApiKey);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('minimalist');
  const [showApiKey, setShowApiKey] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Style predefiniowane
  const styles = [
    { id: 'minimalist', name: 'Minimalizm', prompt: 'clean, minimal background, soft lighting, pastel colors, high end product photography', color: 'bg-gray-100' },
    { id: 'nature', name: 'Natura', prompt: 'placed on a rock with moss, forest background, sunlight filtering through trees, cinematic bokeh', color: 'bg-green-100' },
    { id: 'urban', name: 'Miejski', prompt: 'street style, concrete texture, blurred city lights in background, neon accents, modern vibe', color: 'bg-slate-200' },
    { id: 'luxury', name: 'Luksus', prompt: 'marble surface, gold accents, dark moody lighting, elegant shadows, expensive look', color: 'bg-amber-100' },
    { id: 'kitchen', name: 'Kuchnia', prompt: 'wooden countertop, fresh ingredients around, morning sunlight, cozy home atmosphere', color: 'bg-orange-50' },
    { id: 'podium', name: 'Podium 3D', prompt: '3d render style, geometric podium, floating shapes, abstract background, studio lighting', color: 'bg-purple-100' },
  ];

  // Obsługa przeciągania plików
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  };

  const handleFileInput = (e) => {
    const file = e.target.files[0];
    handleFile(file);
  };

  const handleFile = (file) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setUploadedImage(e.target.result);
        setGeneratedImage(null);
        setErrorMsg('');
      };
      reader.readAsDataURL(file);
    }
  };

  // Funkcja generująca
  const handleGenerate = async () => {
    if (!uploadedImage) return;
    
    setIsGenerating(true);
    setGeneratedImage(null);
    setErrorMsg('');

    // Budowanie promptu
    const stylePrompt = styles.find(s => s.id === selectedStyle)?.prompt || '';
    // W prawdziwym scenariuszu in-painting, wysłalibyśmy też obraz. 
    // Tutaj dla modelu generate-001 wysyłamy silny opis wizualny.
    const fullPrompt = `Create a photorealistic Instagram product photo. Style: ${stylePrompt}. Context: ${prompt || 'A beautiful product display'}. High resolution, 8k, professional photography.`;

    try {
      // Sprawdzamy, czy mamy klucz (z env lub wpisany ręcznie)
      const activeKey = apiKey || defaultApiKey;

      if (activeKey) {
        // --- PRODKUCJA / API CALL ---
        // Używamy modelu Imagen (lub fallback do Gemini Vision jeśli Imagen jest niedostępny dla klucza)
        // Uwaga: Endpoint 'predict' jest dla Imagen, 'generateContent' dla Gemini.
        
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${activeKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            instances: [
              { prompt: fullPrompt }
            ],
            parameters: {
              sampleCount: 1,
              aspectRatio: "1:1" // Format Instagramowy
            }
          })
        });

        if (!response.ok) {
           const errData = await response.json();
           throw new Error(errData.error?.message || 'Błąd API Google');
        }
        
        const data = await response.json();
        
        if (data.predictions && data.predictions[0] && data.predictions[0].bytesBase64Encoded) {
             const imageUrl = `data:image/png;base64,${data.predictions[0].bytesBase64Encoded}`;
             setGeneratedImage(imageUrl);
        } else {
            throw new Error('API nie zwróciło poprawnego obrazu.');
        }

      } else {
        // --- TRYB DEMO (Symulacja) ---
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Mockup keywords
        const mockKeywords = {
            'minimalist': 'minimal,product',
            'nature': 'nature,forest,product',
            'urban': 'urban,neon,street',
            'luxury': 'gold,black,luxury',
            'kitchen': 'food,kitchen,wood',
            'podium': '3d,abstract,render'
        };
        const keyword = mockKeywords[selectedStyle] || 'product';
        // Używamy losowego parametru, aby odświeżyć obraz
        setGeneratedImage(`https://source.unsplash.com/800x800/?${keyword}&sig=${Date.now()}`);
      }
    } catch (error) {
      console.error("Generowanie nie powiodło się:", error);
      setErrorMsg(`Wystąpił błąd: ${error.message}. Przełączono na tryb demo.`);
      
      // Fallback do demo po krótkim opóźnieniu, żeby użytkownik zauważył błąd
      setTimeout(() => {
          setGeneratedImage(`https://source.unsplash.com/800x800/?aesthetic,product&sig=${Date.now()}`);
      }, 1000);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (generatedImage) {
      const link = document.createElement('a');
      link.href = generatedImage;
      link.download = `insta-gen-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Czy używamy klucza systemowego?
  const isUsingEnvKey = !!defaultApiKey && apiKey === defaultApiKey;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-purple-200">
      
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-tr from-purple-600 to-pink-500 p-2 rounded-lg text-white">
              <Instagram size={20} />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-700 to-pink-600">
              InstaGen Agent
            </h1>
          </div>
          <button 
            onClick={() => setShowApiKey(!showApiKey)}
            className={`text-sm font-medium transition-colors flex items-center gap-2 px-3 py-1.5 rounded-full ${
              isUsingEnvKey 
                ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                : apiKey 
                  ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                  : 'text-slate-500 hover:text-purple-600'
            }`}
          >
            {isUsingEnvKey ? <CheckCircle2 size={16} /> : <Settings size={16} />}
            {isUsingEnvKey ? 'API (System)' : apiKey ? 'API (Własne)' : 'Konfiguracja API'}
          </button>
        </div>

        {/* Panel API Key */}
        {showApiKey && (
          <div className="bg-slate-100 border-b border-slate-200 p-4 animate-in slide-in-from-top-2">
            <div className="max-w-6xl mx-auto">
              <div className="flex gap-4 items-center mb-2">
                <input 
                  type="password" 
                  placeholder={isUsingEnvKey ? "Klucz ukryty (zmienna środowiskowa)" : "Wklej klucz Google Gemini API..."}
                  className="flex-1 px-4 py-2 rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-slate-200 disabled:text-slate-500"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  disabled={false} // Zawsze pozwalamy nadpisać
                />
                <button 
                  onClick={() => setShowApiKey(false)}
                  className="px-4 py-2 bg-slate-800 text-white rounded-md hover:bg-slate-900"
                >
                  Zamknij
                </button>
              </div>
              
              {isUsingEnvKey && (
                 <p className="text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle2 size={12} />
                    Aplikacja korzysta z domyślnego klucza serwera (Netlify). Możesz go nadpisać wpisując własny powyżej.
                 </p>
              )}
              {!isUsingEnvKey && !apiKey && (
                 <p className="text-xs text-amber-600 flex items-center gap-1">
                    <AlertCircle size={12} />
                    Brak klucza. Aplikacja działa w trybie DEMO (zdjęcia stockowe).
                 </p>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEWA KOLUMNA - KONTROLA */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* 1. Upload Section */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
              <Layers className="text-purple-600" size={18} />
              <h2 className="font-semibold text-slate-700">1. Wgraj Packshot</h2>
            </div>
            
            <div className="p-6">
              {!uploadedImage ? (
                <div 
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl h-64 flex flex-col items-center justify-center transition-all duration-200 ${
                    isDragging ? 'border-purple-500 bg-purple-50' : 'border-slate-200 hover:border-purple-400 hover:bg-slate-50'
                  }`}
                >
                  <div className="bg-purple-100 p-4 rounded-full mb-4">
                    <Upload className="text-purple-600" size={24} />
                  </div>
                  <p className="text-slate-600 font-medium">Przeciągnij zdjęcie tutaj</p>
                  <p className="text-slate-400 text-sm mb-4">lub kliknij, aby wybrać</p>
                  <label className="cursor-pointer">
                    <span className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium shadow-sm hover:bg-slate-50 transition-colors">
                      Wybierz z dysku
                    </span>
                    <input type="file" className="hidden" accept="image/*" onChange={handleFileInput} />
                  </label>
                </div>
              ) : (
                <div className="relative group rounded-xl overflow-hidden border border-slate-200 bg-checkerboard">
                  <style>{`.bg-checkerboard { background-image: radial-gradient(#cbd5e1 1px, transparent 1px); background-size: 10px 10px; }`}</style>
                  
                  <img src={uploadedImage} alt="Uploaded" className="w-full h-64 object-contain mx-auto" />
                  <button 
                    onClick={() => { setUploadedImage(null); setGeneratedImage(null); }}
                    className="absolute top-2 right-2 p-1.5 bg-white/90 text-slate-700 rounded-full shadow-md hover:text-red-500 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 2. Configuration Section */}
          <div className={`bg-white rounded-2xl shadow-sm border border-slate-100 transition-opacity duration-300 ${!uploadedImage ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
            <div className="p-4 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
              <Wand2 className="text-pink-600" size={18} />
              <h2 className="font-semibold text-slate-700">2. Wybierz Styl i Tło</h2>
            </div>
            
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-3">Styl Scenerii</label>
                <div className="grid grid-cols-3 gap-3">
                  {styles.map((style) => (
                    <button
                      key={style.id}
                      onClick={() => setSelectedStyle(style.id)}
                      className={`relative p-3 rounded-xl border text-left transition-all duration-200 ${
                        selectedStyle === style.id 
                          ? 'border-purple-500 ring-1 ring-purple-500 bg-purple-50' 
                          : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full mb-2 ${style.color} flex items-center justify-center`}>
                        <div className={`w-2 h-2 rounded-full ${selectedStyle === style.id ? 'bg-purple-600' : 'bg-slate-400'}`}></div>
                      </div>
                      <span className={`text-sm font-medium block ${selectedStyle === style.id ? 'text-purple-900' : 'text-slate-600'}`}>
                        {style.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Dodatkowy opis (opcjonalnie)
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="np. Kawa parująca w porannym słońcu, obok gazety..."
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none text-sm min-h-[80px] resize-none"
                />
              </div>

              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold shadow-lg shadow-purple-200 hover:shadow-xl hover:shadow-purple-300 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    Generowanie Magii...
                  </>
                ) : (
                  <>
                    <Sparkles size={20} />
                    Generuj Zdjęcie na Instagram
                  </>
                )}
              </button>
              
              {errorMsg && (
                <div className="text-xs text-red-500 bg-red-50 p-2 rounded-lg border border-red-100 flex gap-2 items-start">
                   <AlertCircle size={14} className="mt-0.5 shrink-0" />
                   {errorMsg}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* PRAWA KOLUMNA - WYNIK */}
        <div className="lg:col-span-7">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 h-full flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <ImageIcon className="text-indigo-600" size={18} />
                <h2 className="font-semibold text-slate-700">Podgląd Posta</h2>
              </div>
              {generatedImage && (
                <span className="text-xs font-medium px-2 py-1 bg-green-100 text-green-700 rounded-md">
                  Gotowe do publikacji
                </span>
              )}
            </div>

            <div className="flex-1 bg-slate-100 p-8 flex items-center justify-center min-h-[500px] relative">
              
              {!uploadedImage && !generatedImage && (
                <div className="text-center text-slate-400 max-w-sm">
                  <div className="mb-4 mx-auto w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm">
                    <Instagram size={32} className="opacity-20" />
                  </div>
                  <h3 className="text-lg font-medium text-slate-500 mb-2">Puste płótno</h3>
                  <p className="text-sm">Wgraj zdjęcie produktu po lewej stronie, aby rozpocząć proces twórczy.</p>
                </div>
              )}

              {isGenerating && (
                <div className="text-center">
                  <div className="relative w-24 h-24 mx-auto mb-6">
                    <div className="absolute inset-0 border-4 border-slate-200 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-purple-600 rounded-full border-t-transparent animate-spin"></div>
                    <Sparkles className="absolute inset-0 m-auto text-purple-600 animate-pulse" size={24} />
                  </div>
                  <h3 className="text-lg font-medium text-slate-700">AI pracuje...</h3>
                  <p className="text-slate-500 text-sm mt-1">Komponuję scenę...</p>
                </div>
              )}

              {generatedImage && !isGenerating && (
                <div className="relative group animate-in zoom-in-95 duration-500 max-w-md w-full bg-white p-3 pb-4 rounded-sm shadow-xl">
                   {/* Mockup Instagram UI */}
                   <div className="flex items-center justify-between mb-3 px-1">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-yellow-400 to-purple-600 p-[2px]">
                           <div className="w-full h-full bg-white rounded-full p-0.5">
                             <div className="w-full h-full bg-slate-200 rounded-full overflow-hidden">
                                <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="avatar" />
                             </div>
                           </div>
                        </div>
                        <span className="text-xs font-semibold">twoja_marka</span>
                      </div>
                      <Settings size={14} className="text-slate-400" />
                   </div>
                   
                   {/* Generated Image */}
                   <div className="aspect-square bg-slate-100 rounded-sm overflow-hidden mb-3 relative group-image">
                      <img src={generatedImage} alt="Generated" className="w-full h-full object-cover" />
                      
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                        <button 
                            onClick={handleDownload}
                            className="p-3 bg-white text-slate-900 rounded-full hover:scale-110 transition-transform shadow-lg"
                            title="Pobierz"
                        >
                            <Download size={20} />
                        </button>
                      </div>
                   </div>

                   {/* Footer Actions */}
                   <div className="flex justify-between items-center px-1 mb-2">
                      <div className="flex gap-3">
                         <span className="text-slate-800"><Share2 size={20} className="rotate-12" /></span>
                         <span className="text-slate-800"><Instagram size={20} /></span>
                      </div>
                   </div>
                   
                   <div className="px-1 space-y-1">
                      <p className="text-xs font-semibold">1,243 polubień</p>
                      <p className="text-xs text-slate-600">
                        <span className="font-semibold text-slate-900 mr-1">twoja_marka</span>
                        {prompt || `Nowa kolekcja w stylu ${styles.find(s=>s.id === selectedStyle)?.name}! ✨ #newdrop #style`}
                      </p>
                   </div>
                </div>
              )}
            </div>

            {/* Footer Result Section */}
            {generatedImage && (
              <div className="p-4 bg-white border-t border-slate-100 flex items-center justify-between">
                <div className="text-xs text-slate-400">InstaGen AI v1.2</div>
                <div className="flex gap-2">
                   <button onClick={handleGenerate} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200 flex items-center gap-2">
                     <RefreshCw size={14} /> Ponów
                   </button>
                   <button onClick={handleDownload} className="px-4 py-2 text-sm bg-slate-900 text-white hover:bg-slate-800 rounded-lg flex items-center gap-2">
                     <Download size={14} /> Pobierz
                   </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default InstaCreator;