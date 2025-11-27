import React, { useState, useRef, useEffect } from 'react';
import { Upload, Check, Loader2, ArrowRight, RefreshCcw, Download, Wand2, Camera, Sun, Armchair, ImageIcon, Building, AlertCircle, Eraser, Move, Layers, XCircle, Info } from 'lucide-react';

const AIProductStudio = () => {
  // --- KONFIGURACJA KLUCZA API ---
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    try {
      if (typeof import.meta !== 'undefined' && import.meta.env) {
        const envKey = import.meta.env.VITE_GOOGLE_API_KEY;
        if (envKey) setApiKey(envKey);
      }
    } catch (e) {
      console.warn('Brak dostępu do zmiennych środowiskowych');
    }
  }, []);

  const [step, setStep] = useState(1);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [selectedStyleIndex, setSelectedStyleIndex] = useState(null);
  
  // Dane wyjściowe
  const [backgroundImage, setBackgroundImage] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Statusy i błędy API
  const [generatorSource, setGeneratorSource] = useState(''); // 'google' | 'pollinations'
  const [apiDebugInfo, setApiDebugInfo] = useState(''); // Dokładny komunikat błędu od Google
  const [error, setError] = useState('');

  // Ustawienia kompozycji (Edycja w Kroku 3)
  const [productScale, setProductScale] = useState(70);
  const [productY, setProductY] = useState(50);
  const [removeWhiteBg, setRemoveWhiteBg] = useState(true);

  const fileInputRef = useRef(null);

  // Style generujące tła
  const styles = [
    {
      id: 'scandi',
      title: 'Produkt na stole',
      icon: <Armchair className="w-6 h-6" />,
      description: 'Jasne drewno, scandi, poranne światło.',
      prompt: "Top down view of a light oak wooden table surface, blurred modern bright living room background, scandi style interior, soft natural morning light coming from a window on the side, photorealistic, 8k resolution, depth of field, empty center area, no objects in center."
    },
    {
      id: 'kids_indoor',
      title: 'Zabawki w pokoju',
      icon: <ImageIcon className="w-6 h-6" />,
      description: 'Puszysty dywan, pastelowe kolory.',
      prompt: "Top down view of a soft fluffy beige carpet surface, cozy nursery room background, blurred colorful toys and blocks in the background, pastel color palette, warm ambient lighting, highly detailed, realistic texture, empty center area, no objects in center."
    },
    {
      id: 'kids_outdoor',
      title: 'Zabawki na dworze',
      icon: <Sun className="w-6 h-6" />,
      description: 'Zielona trawa, słońce, lato.',
      prompt: "Top down view of manicured green grass, sunny backyard garden background, summer atmosphere, vibrant colors, bright sunlight, lens flare, bokeh effect, cinematic lighting, 8k, empty center area, no objects in center."
    },
    {
      id: 'outdoor_commercial',
      title: 'Produkt Outdoor',
      icon: <Building className="w-6 h-6" />,
      description: 'Betonowe patio, złota godzina.',
      prompt: "Top down view of a modern grey concrete patio surface, blurred outdoor nature background with potted plants, golden hour lighting, dramatic shadows, architectural elements, high contrast, crisp details, photorealistic, empty center area, no objects in center."
    }
  ];

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImage(reader.result);
        setError('');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    if (!uploadedImage || selectedStyleIndex === null) return;

    setIsGenerating(true);
    setError('');
    setApiDebugInfo(''); // Reset błędów
    setBackgroundImage(null);
    setGeneratorSource('');

    const selectedStylePrompt = styles[selectedStyleIndex].prompt;
    
    try {
        let imageUrl = null;
        let source = 'pollinations'; // Domyślnie zakładamy fallback
        let debugMsg = '';

        // --- PRÓBA 1: GOOGLE IMAGEN ---
        if (apiKey) {
            try {
                // Używamy modelu Imagen 2.0
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/imagen-2.0-generate-001:predict?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        instances: [{ prompt: selectedStylePrompt }],
                        parameters: { sampleCount: 1, aspectRatio: "1:1" }
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.predictions?.[0]?.bytesBase64Encoded) {
                        imageUrl = `data:image/png;base64,${data.predictions[0].bytesBase64Encoded}`;
                        source = 'google';
                    }
                } else {
                    // Pobieramy dokładny błąd od Google
                    const errData = await response.json().catch(() => ({}));
                    const status = response.status;
                    const message = errData.error?.message || response.statusText;
                    debugMsg = `Google API Błąd ${status}: ${message}`;
                    console.warn(debugMsg);
                }
            } catch (googleErr) {
                debugMsg = `Błąd połączenia: ${googleErr.message}`;
                console.error("Błąd połączenia z Google:", googleErr);
            }
        } else {
            debugMsg = "Pominięto Google API: Brak klucza w konfiguracji.";
        }

        // --- PRÓBA 2: POLLINATIONS (Fallback) ---
        if (!imageUrl) {
            // Jeśli nie mamy obrazu, ustawiamy info o błędzie Google, żeby wyświetlić użytkownikowi
            setApiDebugInfo(debugMsg);
            
            const seed = Math.floor(Math.random() * 1000000);
            const encodedPrompt = encodeURIComponent(selectedStylePrompt);
            imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?seed=${seed}&width=1024&height=1024&nologo=true&model=flux`;
            source = 'pollinations';
        }
        
        // Ładowanie obrazu (Preload)
        await new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = resolve;
            img.onerror = reject;
            img.src = imageUrl;
        });
        
        setBackgroundImage(imageUrl);
        setGeneratorSource(source);
        setStep(3);
        
    } catch (err) {
        console.error(err);
        setError('Nie udało się wygenerować tła. Sprawdź połączenie.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadComposite = () => {
    if (!uploadedImage || !backgroundImage) return;

    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d');

    const bgImg = new Image();
    bgImg.crossOrigin = "anonymous";
    bgImg.src = backgroundImage;

    bgImg.onload = () => {
      ctx.drawImage(bgImg, 0, 0, 1080, 1080);

      const prodImg = new Image();
      prodImg.src = uploadedImage;
      prodImg.onload = () => {
        const scale = productScale / 100;
        const w = 1080 * scale; 
        const ratio = prodImg.width / prodImg.height;
        const drawH = w / ratio; 
        
        const x = (1080 - w) / 2;
        const y = (1080 * (productY / 100)) - (drawH / 2);

        if (removeWhiteBg) {
            ctx.globalCompositeOperation = 'multiply';
        }

        ctx.drawImage(prodImg, x, y, w, drawH);
        ctx.globalCompositeOperation = 'source-over';

        const link = document.createElement('a');
        link.download = `notato-studio-${Date.now()}.jpg`;
        link.href = canvas.toDataURL('image/jpeg', 0.9);
        link.click();
      };
    };
  };

  const resetProcess = () => {
    setStep(1);
    setBackgroundImage(null);
    setUploadedImage(null);
    setSelectedStyleIndex(null);
    setProductScale(70);
    setProductY(50);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-blue-100">
      
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 text-white p-2 rounded-lg">
              <Camera size={20} />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-600">
              AI Product Studio
            </h1>
          </div>
          <div className="flex items-center gap-4">
             {/* Wskaźnik statusu API */}
             {apiKey ? (
                <div className="hidden sm:flex items-center gap-1.5 text-xs text-green-700 bg-green-50 px-3 py-1.5 rounded-full border border-green-200 font-medium">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                    Gemini API: Aktywne
                </div>
             ) : (
                <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200 font-medium">
                    <div className="w-2 h-2 rounded-full bg-slate-400"></div>
                    Gemini API: Brak Klucza (Tryb Demo)
                </div>
             )}
             
             <div className="text-sm text-slate-500 font-medium border-l pl-4 ml-2">
               Krok {step} z 3
             </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        
        {/* Krok 1: Upload */}
        {step === 1 && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-slate-900 mb-2">Wgraj swój produkt</h2>
              <p className="text-slate-500">Wgraj packshot (produkt na białym tle). System usunie białe tło automatycznie.</p>
            </div>

            <div 
              className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-300 ${uploadedImage ? 'border-blue-500 bg-blue-50/50' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onloadend = () => setUploadedImage(reader.result);
                    reader.readAsDataURL(file);
                }
              }}
            >
              {!uploadedImage ? (
                <div className="flex flex-col items-center gap-4 py-12">
                  <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-2">
                    <Upload size={32} />
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-slate-700">Przeciągnij zdjęcie tutaj</p>
                    <p className="text-sm text-slate-400 mt-1">lub kliknij, aby wybrać plik</p>
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleFileUpload} 
                    accept="image/*" 
                    className="hidden" 
                  />
                  <button 
                    onClick={() => fileInputRef.current.click()}
                    className="px-6 py-2 bg-white border border-slate-300 rounded-full text-slate-700 font-medium hover:bg-slate-50 transition-colors shadow-sm"
                  >
                    Wybierz plik
                  </button>
                </div>
              ) : (
                <div className="relative group">
                  <img src={uploadedImage} alt="Uploaded" className="max-h-96 mx-auto rounded-lg shadow-lg object-contain bg-white" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                    <button 
                      onClick={() => setUploadedImage(null)}
                      className="bg-white/90 text-red-600 px-4 py-2 rounded-full font-medium hover:bg-white transition-colors"
                    >
                      Usuń zdjęcie
                    </button>
                  </div>
                </div>
              )}
            </div>

            {uploadedImage && (
              <div className="mt-8 flex justify-end">
                <button 
                  onClick={() => setStep(2)}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-semibold transition-all shadow-md hover:shadow-lg transform active:scale-95"
                >
                  Dalej <ArrowRight size={18} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Krok 2: Wybór Stylu */}
        {step === 2 && (
          <div className="animate-in fade-in slide-in-from-right-8 duration-500">
            <div className="flex items-center gap-2 mb-6 cursor-pointer text-slate-500 hover:text-blue-600 transition-colors" onClick={() => setStep(1)}>
               <ArrowRight className="rotate-180" size={16} /> Wróć do zdjęcia
            </div>
            
            <h2 className="text-3xl font-bold text-slate-900 mb-2 text-center">Wybierz styl aranżacji</h2>
            <p className="text-slate-500 text-center mb-8">AI wygeneruje tło, na którym umieścimy Twój produkt.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              {styles.map((style, index) => (
                <div 
                  key={style.id}
                  onClick={() => setSelectedStyleIndex(index)}
                  className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 hover:shadow-md ${selectedStyleIndex === index ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-600 ring-offset-2' : 'border-slate-200 bg-white hover:border-blue-300'}`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-lg ${selectedStyleIndex === index ? 'bg-blue-200 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                      {style.icon}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900">{style.title}</h3>
                      <p className="text-sm text-slate-500 mt-1 leading-relaxed">{style.description}</p>
                    </div>
                  </div>
                  {selectedStyleIndex === index && (
                    <div className="absolute top-4 right-4 text-blue-600">
                      <Check size={20} />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <button 
              onClick={handleGenerate}
              disabled={selectedStyleIndex === null || isGenerating}
              className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-lg ${
                selectedStyleIndex !== null && !isGenerating
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:scale-[1.02] active:scale-[0.98]' 
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="animate-spin" /> Generowanie tła...
                </>
              ) : (
                <>
                  <Wand2 size={20} /> Stwórz studio
                </>
              )}
            </button>
            
            {error && (
              <div className="mt-4 p-4 bg-red-50 text-red-600 rounded-lg text-sm text-center">
                {error}
              </div>
            )}
          </div>
        )}

        {/* Krok 3: Wynik i Edycja */}
        {step === 3 && backgroundImage && (
          <div className="animate-in fade-in zoom-in duration-500">
            <h2 className="text-2xl font-bold text-slate-900 mb-2 text-center">Twoje Studio</h2>
            
            {/* Informacja o źródle generowania i ewentualnych błędach */}
            <div className="flex justify-center mb-4">
                {generatorSource === 'google' ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        <Layers size={12} /> Generowane przez Google Imagen 2
                    </span>
                ) : (
                    <div className="flex flex-col items-center gap-1">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                            <Info size={12} /> Tło: Flux (Fallback)
                        </span>
                        {apiDebugInfo && (
                             <span className="text-[10px] text-red-500 max-w-md text-center">
                                 Powód: {apiDebugInfo}
                             </span>
                        )}
                    </div>
                )}
            </div>

            {/* Obszar roboczy */}
            <div className="bg-white p-2 rounded-2xl shadow-xl border border-slate-200 mb-6 relative overflow-hidden group">
               {/* Kontener 1:1 */}
               <div className="relative w-full aspect-square bg-slate-100 rounded-xl overflow-hidden">
                  
                  {/* Warstwa 1: Tło */}
                  <img 
                    src={backgroundImage} 
                    alt="Background" 
                    className="absolute inset-0 w-full h-full object-cover"
                  />

                  {/* Warstwa 2: Produkt */}
                  {uploadedImage && (
                    <img 
                        src={uploadedImage} 
                        alt="Product"
                        className="absolute transition-all duration-75 cursor-move"
                        style={{
                            width: `${productScale}%`,
                            left: '50%',
                            top: `${productY}%`,
                            transform: 'translate(-50%, -50%)',
                            mixBlendMode: removeWhiteBg ? 'multiply' : 'normal'
                        }}
                    />
                  )}
               </div>
            </div>

            {/* Panel Sterowania */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-6">
                <div className="flex items-center gap-2 mb-4 text-slate-700 font-semibold">
                    <Move size={18} className="text-blue-600"/> Dopasuj produkt
                </div>
                
                <div className="space-y-6">
                    <div>
                        <label className="text-xs text-slate-500 font-medium flex justify-between mb-2">
                            Wielkość <span>{productScale}%</span>
                        </label>
                        <input 
                            type="range" 
                            min="10" 
                            max="150" 
                            value={productScale} 
                            onChange={(e) => setProductScale(Number(e.target.value))} 
                            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                    </div>
                    
                    <div>
                        <label className="text-xs text-slate-500 font-medium flex justify-between mb-2">
                            Pozycja (Góra-Dół)
                        </label>
                        <input 
                            type="range" 
                            min="0" 
                            max="100" 
                            value={productY} 
                            onChange={(e) => setProductY(Number(e.target.value))} 
                            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                        <div className="flex items-center gap-2 text-sm text-slate-700">
                            <Eraser size={16} /> 
                            <span>Usuń białe tło (Tryb Multiply)</span>
                        </div>
                        <button 
                            onClick={() => setRemoveWhiteBg(!removeWhiteBg)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${removeWhiteBg ? 'bg-blue-600' : 'bg-slate-300'}`}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out ${removeWhiteBg ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button 
                onClick={handleDownloadComposite}
                className="flex items-center justify-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-xl font-semibold hover:bg-slate-800 transition-colors shadow-lg hover:scale-105 transform duration-200"
              >
                <Download size={18} /> Pobierz gotowe zdjęcie
              </button>
              <button 
                onClick={resetProcess}
                className="flex items-center justify-center gap-2 bg-white border border-slate-300 text-slate-700 px-6 py-3 rounded-xl font-semibold hover:bg-slate-50 transition-colors"
              >
                <RefreshCcw size={18} /> Zacznij od nowa
              </button>
            </div>
            
            <div className="mt-8 text-center">
               <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Wygenerowane tło</p>
               <p className="text-sm text-slate-500 mt-2 italic">
                 {styles[selectedStyleIndex].title}
               </p>
            </div>
          </div>
        )}

      </main>
    </div>
  );
};

export default AIProductStudio;