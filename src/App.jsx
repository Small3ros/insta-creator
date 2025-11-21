import React, { useState, useEffect } from 'react';
import { Upload, Image as ImageIcon, Sparkles, Download, Settings, RefreshCw, Share2, Instagram, Wand2, Layers, Loader2, X, AlertCircle, CheckCircle2, ScanSearch, Copy } from 'lucide-react';

const InstaCreator = () => {
  // --- KONFIGURACJA ---
  // Zabezpieczony odczyt klucza API (działa na Netlify i w podglądzie)
  let defaultApiKey = '';
  try {
    if (import.meta && import.meta.env) {
      defaultApiKey = import.meta.env.VITE_GOOGLE_API_KEY || '';
    }
  } catch (e) {
    console.warn('Preview mode: env vars not accessible');
  }
  
  const [apiKey, setApiKey] = useState(defaultApiKey);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Stany procesu
  const [isAnalyzing, setIsAnalyzing] = useState(false); // Nowy stan dla OCR/Vision
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Dane wyjściowe
  const [generatedImage, setGeneratedImage] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null); // Wynik skanowania produktu
  const [postCaption, setPostCaption] = useState(''); // Treść posta dla notato.pl
  
  const [prompt, setPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('minimalist');
  const [errorMsg, setErrorMsg] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);

  // Aktualizacja klucza
  useEffect(() => {
    if (defaultApiKey && !apiKey) setApiKey(defaultApiKey);
  }, [defaultApiKey]);

  // --- NOWE STYLE DLA NOTATO.PL ---
  // Zoptymalizowane pod kątem zachowania wierności produktu i estetyki "stationery"
  const styles = [
    { 
      id: 'minimalist', 
      name: 'Clean Desk', 
      prompt: 'high-end stationery photography, clean white desk setup, soft natural window lighting, minimalist aesthetic, centered product, sharp focus, 8k, highly detailed texture', 
      color: 'bg-gray-100' 
    },
    { 
      id: 'warm', 
      name: 'Cozy Planning', 
      prompt: 'warm cozy atmosphere, wooden desk surface, soft morning sunlight, coffee cup nearby (blurred), lifestyle photography, golden hour lighting, product in focus', 
      color: 'bg-orange-50' 
    },
    { 
      id: 'business', 
      name: 'Professional', 
      prompt: 'sleek modern office environment, glass and metal accents, cool toned lighting, professional business look, depth of field, sharp product details', 
      color: 'bg-slate-200' 
    },
    { 
      id: 'nature', 
      name: 'Botanical', 
      prompt: 'placed on natural stone surface, surrounded by green eucalyptus leaves, soft shadows, organic feel, fresh, eco-friendly vibe, bright lighting', 
      color: 'bg-green-100' 
    },
    { 
      id: 'dark', 
      name: 'Elegant Dark', 
      prompt: 'dark moody aesthetic, black matte surface, dramatic lighting, elegant shadows, premium luxury feel, gold accents highlighted', 
      color: 'bg-slate-800 text-white' 
    },
    { 
      id: 'flatlay', 
      name: 'Creative Flatlay', 
      prompt: 'knolling photography style, organized flatlay on pastel background, surrounded by pens and clips, perfectly aligned, geometric composition, top-down view', 
      color: 'bg-purple-100' 
    },
  ];

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e) => { e.preventDefault(); setIsDragging(false); const file = e.dataTransfer.files[0]; handleFile(file); };
  const handleFileInput = (e) => { const file = e.target.files[0]; handleFile(file); };

  const handleFile = (file) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target.result;
        setUploadedImage(base64);
        setGeneratedImage(null);
        setAnalysisResult(null);
        setPostCaption('');
        setErrorMsg('');
        
        // Automatyczne uruchomienie analizy po wgraniu
        analyzeProduct(base64, apiKey || defaultApiKey);
      };
      reader.readAsDataURL(file);
    }
  };

  // --- FUNKCJA 1: SKANOWANIE PRODUKTU (GEMINI VISION) ---
  const analyzeProduct = async (imageBase64, key) => {
    if (!key) return; // Bez klucza pomijamy analizę
    
    setIsAnalyzing(true);
    try {
      // Wycinamy nagłówek "data:image/png;base64,"
      const base64Data = imageBase64.split(',')[1]; 
      const mimeType = imageBase64.split(';')[0].split(':')[1];

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: `Jesteś ekspertem marketingu dla marki 'notato.pl' (sklep z planerami, notatnikami, akcesoriami biurowymi). 
              
              Zadanie 1 (Opis): Przeanalizuj to zdjęcie produktu. Opisz go BARDZO szczegółowo po angielsku (kolor, faktura, napisy, kształt), tak aby generator obrazu mógł go odtworzyć w 100% identycznie. Skup się na fizycznych cechach.
              
              Zadanie 2 (Instagram): Napisz po polsku angażujący post na Instagram dla tego produktu. Użyj emoji. Nawiąż do organizacji, planowania, sukcesu. Oznacz @notato.pl.
              
              Zadanie 3 (Styl): Wybierz jeden styl z listy: [Clean Desk, Cozy Planning, Professional, Botanical, Elegant Dark, Creative Flatlay], który najlepiej pasuje do tego produktu.

              Zwróć odpowiedź w formacie JSON:
              {
                "visualDescription": "text description...",
                "instagramCaption": "text post...",
                "suggestedStyle": "style name"
              }` },
              { inlineData: { mimeType: mimeType, data: base64Data } }
            ]
          }]
        })
      });

      const data = await response.json();
      
      // Bezpieczne pobieranie tekstu z odpowiedzi
      const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!textResponse) {
        throw new Error("Brak odpowiedzi od AI.");
      }
      
      // Czyszczenie JSONA (Gemini czasem dodaje ```json ... ```)
      const jsonStr = textResponse.replace(/```json|```/g, '').trim();
      const analysis = JSON.parse(jsonStr);

      setAnalysisResult(analysis);
      setPostCaption(analysis.instagramCaption);
      
      // Auto-wybór stylu
      const matchedStyle = styles.find(s => s.name.toLowerCase().includes(analysis.suggestedStyle.toLowerCase()));
      if (matchedStyle) setSelectedStyle(matchedStyle.id);

    } catch (error) {
      console.error("Błąd analizy obrazu:", error);
      // Nie blokujemy UI, po prostu nie mamy analizy
    } finally {
      setIsAnalyzing(false);
    }
  };

  // --- FUNKCJA 2: GENEROWANIE OBRAZU (POLLINATIONS) ---
  const handleGenerate = async () => {
    if (!uploadedImage) return;
    setIsGenerating(true);
    setGeneratedImage(null);
    setErrorMsg('');

    const styleObj = styles.find(s => s.id === selectedStyle);
    
    // Używamy opisu z analizy AI jeśli dostępny, w przeciwnym razie ogólny
    const productDescription = analysisResult?.visualDescription || "a generic product";
    
    // Konstrukcja Promptu "Fidelity First"
    const fullPrompt = `
      Product photography of ${productDescription}. 
      Style: ${styleObj?.prompt}. 
      Details: The product MUST look exactly like the description. Centered composition, uncropped, 100% complete item visible, sharp focus, 8k resolution, photorealistic, commercial photography.
      ${prompt}
    `.trim();

    try {
      const seed = Math.floor(Math.random() * 1000000);
      const encodedPrompt = encodeURIComponent(fullPrompt);
      // Dodajemy parametr "enhance=false" żeby Pollinations nie zmieniało zbytnio naszego precyzyjnego opisu
      const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?seed=${seed}&width=1080&height=1080&nologo=true&model=flux&enhance=false`;

      // Pre-loading obrazu
      const img = new Image();
      img.src = imageUrl;
      img.onload = () => { setGeneratedImage(imageUrl); setIsGenerating(false); };
      img.onerror = () => { throw new Error("Błąd serwera obrazów."); };

    } catch (error) {
      setErrorMsg(`Błąd: ${error.message}`);
      setIsGenerating(false);
    }
  };

  const handleDownload = async () => {
    if (generatedImage) {
      try {
        const response = await fetch(generatedImage);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `notato-post-${Date.now()}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (e) { window.open(generatedImage, '_blank'); }
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(postCaption);
    alert("Treść posta skopiowana!");
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-purple-200">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-slate-900 p-2 rounded-lg text-white">
              <Layers size={20} />
            </div>
            <div>
               <h1 className="text-xl font-bold text-slate-900 tracking-tight">notato<span className="text-purple-600">.AI</span></h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className={`text-xs font-medium px-3 py-1 rounded-full flex items-center gap-1 ${apiKey ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
               {apiKey ? <><CheckCircle2 size={12} /> System Gotowy</> : <><AlertCircle size={12} /> Tryb Demo (Brak analizy)</>}
            </div>
            <button onClick={() => setShowApiKey(!showApiKey)} className="p-2 hover:bg-slate-100 rounded-full"><Settings size={18} /></button>
          </div>
        </div>

        {showApiKey && (
          <div className="bg-slate-100 border-b border-slate-200 p-4">
            <div className="max-w-6xl mx-auto flex gap-4">
              <input type="password" placeholder="Klucz Google Gemini API..." className="flex-1 px-4 py-2 rounded-md border" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
              <button onClick={() => setShowApiKey(false)} className="px-4 py-2 bg-slate-800 text-white rounded-md">Zamknij</button>
            </div>
          </div>
        )}
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEWA KOLUMNA - INPUT */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* 1. Upload & OCR */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
               <div className="flex items-center gap-2 font-semibold text-slate-700">
                  <ScanSearch className="text-purple-600" size={18} /> 
                  1. Skanowanie Produktu
               </div>
               {isAnalyzing && <span className="text-xs text-purple-600 animate-pulse flex items-center gap-1"><Loader2 size={10} className="animate-spin"/> Analiza AI...</span>}
            </div>
            <div className="p-6">
              {!uploadedImage ? (
                <div 
                  onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl h-64 flex flex-col items-center justify-center transition-all duration-200 ${isDragging ? 'border-purple-500 bg-purple-50' : 'border-slate-200 hover:border-purple-400 hover:bg-slate-50'}`}
                >
                  <Upload className="text-slate-400 mb-4" size={32} />
                  <p className="text-slate-600 font-medium">Wgraj zdjęcie produktu</p>
                  <p className="text-xs text-slate-400 mt-2 text-center max-w-[200px]">AI automatycznie rozpozna produkt i zaproponuje treść.</p>
                  <label className="cursor-pointer mt-4">
                    <span className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors">Wybierz plik</span>
                    <input type="file" className="hidden" accept="image/*" onChange={handleFileInput} />
                  </label>
                </div>
              ) : (
                <div className="relative group rounded-xl overflow-hidden border border-slate-200 bg-checkerboard">
                  <style>{`.bg-checkerboard { background-image: radial-gradient(#cbd5e1 1px, transparent 1px); background-size: 10px 10px; }`}</style>
                  <img src={uploadedImage} alt="Uploaded" className="w-full h-64 object-contain mx-auto" />
                  <button onClick={() => { setUploadedImage(null); setAnalysisResult(null); }} className="absolute top-2 right-2 p-1.5 bg-white/90 text-slate-700 rounded-full shadow-md hover:text-red-500"><X size={16} /></button>
                  
                  {analysisResult && (
                    <div className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm p-3 border-t border-slate-100">
                       <div className="flex items-start gap-2">
                          <CheckCircle2 size={16} className="text-green-600 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs font-bold text-slate-800">Rozpoznano:</p>
                            <p className="text-xs text-slate-600 line-clamp-2">{analysisResult.visualDescription}</p>
                          </div>
                       </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 2. Konfiguracja */}
          <div className={`bg-white rounded-2xl shadow-sm border border-slate-100 transition-opacity duration-300 ${!uploadedImage ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
            <div className="p-4 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
              <Wand2 className="text-purple-600" size={18} />
              <h2 className="font-semibold text-slate-700">2. Wybierz Scenerię</h2>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-3 flex justify-between">
                   Styl
                   {analysisResult && <span className="text-xs text-purple-600 font-normal">Sugerowany: {analysisResult.suggestedStyle}</span>}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {styles.map((style) => (
                    <button key={style.id} onClick={() => setSelectedStyle(style.id)} className={`relative p-3 rounded-xl border text-left transition-all duration-200 ${selectedStyle === style.id ? 'border-purple-500 bg-purple-50 ring-1 ring-purple-500' : 'border-slate-200 hover:border-slate-300'}`}>
                      <div className={`w-full h-2 rounded-full mb-2 ${style.color}`}></div>
                      <span className={`text-sm font-medium block ${selectedStyle === style.id ? 'text-purple-900' : 'text-slate-600'}`}>{style.name}</span>
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="bg-amber-50 p-3 rounded-lg border border-amber-100 text-xs text-amber-800">
                 <strong>Wskazówka:</strong> Aby produkt na zdjęciu był w 100% identyczny, AI wykorzystuje precyzyjny opis z analizy OCR. Wynik może być "kreatywną interpretacją" w wysokiej jakości.
              </div>

              <button onClick={handleGenerate} disabled={isGenerating || isAnalyzing} className="w-full py-4 bg-slate-900 text-white rounded-xl font-semibold shadow-lg hover:bg-slate-800 hover:scale-[1.01] transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed">
                {isGenerating ? <><Loader2 className="animate-spin" size={20} /> Renderowanie...</> : <><Sparkles size={20} /> Generuj Zdjęcie</>}
              </button>
              {errorMsg && <div className="text-xs text-red-500 p-2 bg-red-50 rounded border border-red-100">{errorMsg}</div>}
            </div>
          </div>
        </div>

        {/* PRAWA KOLUMNA - WYNIK */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Podgląd Graficzny */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2"><ImageIcon className="text-slate-600" size={18} /><h2 className="font-semibold text-slate-700">Podgląd Instagram</h2></div>
              {generatedImage && <button onClick={handleDownload} className="text-xs font-medium px-3 py-1.5 bg-slate-900 text-white rounded-md hover:bg-slate-800 flex gap-2 items-center"><Download size={12}/> Pobierz JPG</button>}
            </div>
            
            <div className="bg-slate-100 p-8 flex items-center justify-center min-h-[400px]">
              {!uploadedImage && !generatedImage && <div className="text-center text-slate-400"><Instagram size={48} className="mx-auto opacity-20 mb-2" /><p>Tutaj pojawi się Twoje zdjęcie</p></div>}
              
              {isGenerating && <div className="text-center animate-pulse"><div className="w-64 h-64 bg-slate-200 rounded-lg mx-auto mb-4"></div><p className="text-slate-500 font-medium">AI tworzy sesję zdjęciową...</p></div>}
              
              {generatedImage && !isGenerating && (
                <div className="bg-white p-4 pb-6 rounded shadow-xl max-w-sm w-full animate-in fade-in zoom-in-95 duration-500">
                   <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden border border-slate-300"><img src="https://api.dicebear.com/7.x/initials/svg?seed=NP&backgroundColor=1e293b" alt="logo" /></div>
                        <span className="text-sm font-semibold">notato.pl</span>
                      </div>
                      <Settings size={16} className="text-slate-300" />
                   </div>
                   <div className="aspect-square bg-slate-100 rounded overflow-hidden mb-4 relative group">
                      <img src={generatedImage} alt="Generated" className="w-full h-full object-cover" />
                   </div>
                   <div className="flex gap-4 text-slate-800 mb-3">
                      <Instagram size={24} />
                      <Share2 size={24} className="rotate-12" />
                   </div>
                   <div className="text-sm">
                      <p className="font-semibold mb-1">243 polubień</p>
                      <p className="text-slate-600"><span className="font-semibold text-slate-900 mr-1">notato.pl</span> 
                        {postCaption ? postCaption.split(' ').slice(0, 8).join(' ') + '...' : 'Nowość w ofercie! ✨ #planowanie'}
                      </p>
                   </div>
                </div>
              )}
            </div>
          </div>

          {/* Podgląd Tekstowy (Copywriting) */}
          {postCaption && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden animate-in slide-in-from-bottom-4">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-purple-50/50">
                <div className="flex items-center gap-2 text-purple-900 font-semibold">
                   <Sparkles size={16} /> Propozycja Treści Posta (AI)
                </div>
                <button onClick={copyToClipboard} className="text-xs text-purple-700 hover:text-purple-900 flex items-center gap-1 font-medium"><Copy size={12} /> Kopiuj</button>
              </div>
              <div className="p-6">
                 <textarea 
                    className="w-full h-32 text-sm text-slate-600 bg-transparent border-none resize-none focus:ring-0 p-0" 
                    value={postCaption} 
                    readOnly
                 />
                 <div className="mt-2 pt-3 border-t border-slate-100 flex gap-2 flex-wrap">
                    {['#notato', '#planowanie', '#organizacja', '#biuro'].map(tag => (
                      <span key={tag} className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded-full">{tag}</span>
                    ))}
                 </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
};

export default InstaCreator;