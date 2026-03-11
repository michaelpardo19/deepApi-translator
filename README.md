# DeepL Translator — Vercel Deploy

Traductor local/web basado en la API de DeepL, adaptado para desplegarse en **Vercel** con Serverless Functions.

## Estructura del proyecto

```
deepl-translator/
├── api/
│   ├── languages.js          # GET  /api/languages
│   ├── translate.js          # POST /api/translate
│   ├── translate-document.js # POST /api/translate-document
│   └── usage.js              # GET  /api/usage
├── public/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── vercel.json
└── package.json
```

---

## Deploy en Vercel

### 1. Sube el código a GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/tu-usuario/deepl-translator.git
git push -u origin main
```

### 2. Importa el proyecto en Vercel

1. Ve a [vercel.com](https://vercel.com) → **Add New Project**
2. Selecciona tu repositorio de GitHub
3. Vercel detectará automáticamente la configuración

### 3. ⚠️ Configura la variable de entorno (IMPRESCINDIBLE)

En Vercel, antes de hacer deploy:

1. Ve a tu proyecto → **Settings** → **Environment Variables**
2. Añade:
   - **Name:** `DEEPL_API_KEY`
   - **Value:** tu clave de DeepL (termina en `:fx` si es la cuenta Free)
   - **Environment:** Production, Preview, Development (marca los tres)
3. Haz clic en **Save**
4. Ve a **Deployments** → haz clic en los tres puntos del último deploy → **Redeploy**

> Sin este paso la app dará error 500 en todas las llamadas a la API.

---

## Uso en local (opcional)

```bash
npm install
```

Crea un archivo `.env.local` (Vercel CLI lo lee automáticamente):

```
DEEPL_API_KEY=tu_api_key_aqui
```

Instala Vercel CLI y arranca el entorno local:

```bash
npm i -g vercel
vercel dev
```

Abre **http://localhost:3000**

---

## Notas sobre la cuenta Free de DeepL

- Las claves Free terminan en `:fx` — el código lo detecta automáticamente y usa `api-free.deepl.com`
- Límite mensual: **500.000 caracteres**
- Documentos: máximo **10 MB** por archivo
- Formatos soportados: `.pdf`, `.docx`, `.pptx`, `.xlsx`, `.txt`, `.html`, `.rtf`, `.odt`
