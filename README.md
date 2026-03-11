# DeepL Translator Local

Traductor local completo basado en la API de DeepL, con backend Node.js + Express.

## Características

- ✅ **Traducción de texto** en tiempo real (hasta 5.000 caracteres)
- ✅ **Detección automática** del idioma de origen
- ✅ **Intercambio** de idiomas de origen/destino
- ✅ **Traducción de documentos** (.pdf, .docx, .pptx, .xlsx, .txt, .html, .rtf, .odt)
- ✅ **Descarga** del documento traducido
- ✅ **Monitor de uso** de caracteres de tu cuenta
- ✅ **API key segura** — nunca se expone al navegador

---

## Instalación

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar la API key

Copia el archivo de ejemplo y añade tu clave:

```bash
cp .env.example .env
```

Edita `.env`:

```
DEEPL_API_KEY=tu_api_key_aqui
```

> 💡 Si usas la cuenta **Free**, tu clave termina en `:fx`. El servidor lo detecta automáticamente y usa el endpoint correcto (`api-free.deepl.com`).

---

## Uso

```bash
npm start
```

Abre el navegador en: **http://localhost:3000**

Para desarrollo con auto-reinicio:

```bash
npm run dev
```

---

## Estructura del proyecto

```
deepl-translator/
├── server.js           # Backend Express (proxy seguro a DeepL)
├── public/
│   └── index.html      # Frontend completo (una sola página)
├── uploads/            # Carpeta temporal para documentos (se limpia automáticamente)
├── .env                # Tu API key (no subas esto a git)
├── .env.example        # Plantilla de configuración
├── .gitignore
└── package.json
```

---

## Endpoints del servidor

| Método | Ruta                      | Descripción                      |
|--------|---------------------------|----------------------------------|
| GET    | `/api/languages`          | Lista de idiomas disponibles     |
| POST   | `/api/translate`          | Traducir texto                   |
| POST   | `/api/translate-document` | Subir y traducir documento       |
| GET    | `/api/usage`              | Uso de caracteres de tu cuenta   |

---

## Formatos de documento soportados

| Formato | Extensión |
|---------|-----------|
| PDF     | `.pdf`    |
| Word    | `.docx`, `.doc` |
| PowerPoint | `.pptx` |
| Excel   | `.xlsx`   |
| Texto   | `.txt`    |
| HTML    | `.html`, `.htm` |
| RTF     | `.rtf`    |
| OpenDocument | `.odt` |

> Límite de tamaño: **10 MB por archivo** (límite de la API Free de DeepL).

---

## Notas sobre la API Free

- Límite mensual: **500.000 caracteres**
- El uso se muestra en la esquina superior derecha de la interfaz
- Documentos almacenados temporalmente en DeepL; descárgalos cuanto antes
