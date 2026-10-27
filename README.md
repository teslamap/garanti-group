# Current production website

The active site is https://teslamap.github.io/garanti-group/ with Firebase Auth/Firestore, public project photos in Supabase through the Cloudflare Worker, and Georgian AI chat at `https://garanti-group-ai.suloanani1.workers.dev/api/chat`.

See [2026-10-27 review and verification](docs/review-2026-10-27.md) for current findings, changes and remaining checks. Order photo submission remains disabled by configuration; public project uploads and private order attachments are separate systems. The Node server and older setup instructions below are alternatives, not the current Pages deployment.

# Garanti Group — ჩატით ფასის შეფასება

არსებული გვერდი შენარჩუნებულია; დაემატა ქართული AI ჩატი და გამოთვლამდე შესამოწმებელი ფორმა. ეს არის მოსამზადებელი ვერსია: რეალური ფასები არ არის შეყვანილი და AI გასაღები არ არის დაყენებული.

## გაშვება

საჭიროა Node.js 22 ან ახალი. დააკოპირეთ `.env.example` როგორც `.env`; ჩაწერეთ საკუთარი `OPENAI_API_KEY`. შემდეგ გაუშვით `npm start` და გახსენით http://localhost:3000. გასაღები HTML-ში ან GitHub-ში არ ატვირთოთ. ტესტები: `npm test`.

## Excel-ის დაკავშირება

Excel ჯერ არ მიგვიღია. იმპორტი შეიქმნება მისი რეალური სვეტებისა და ფორმულების მიხედვით. თითო პროფილისთვის საჭიროა კოდი, დასახელება, საზომი ერთეული, ტარიფი და განმარტება, რას მოიცავს ფასი (მინა, ფურნიტურა, შეღებვა, დღგ, მონტაჟი). თუ ცხრილი მხოლოდ ნედლი პროფილის ღირებულებას შეიცავს, მზა კარ-ფანჯრის დასათვლელად დამატებითი კომპლექტაციის ფორმულები დაგვჭირდება.

`pricing.json`-ში `profiles` ახლა ცარიელია. თითო ჩანაწერის ფორმატი: `id`, `name`, `unit` (`m2`, `linear_m`, `piece`), `rate`, `installationRate`, `approved` და `notes`. ფასები ლარშია. მონტაჟის ტარიფი იგივე ერთეულზე ითვლება. გრძივ მეტრში გამოიყენება სიგანე/სიგრძე × რაოდენობა; მ²-ში — სიგანე × სიმაღლე × რაოდენობა. დაამტკიცეთ მხოლოდ ბიზნესის წესებთან შემოწმებული ტარიფები. რთულ კომპლექტაციას ფორმულის გაფართოება სჭირდება.

## განთავსება GitHub Pages-ზე

`public/project1.html`, `public/chat.css`, `public/chat.js` განთავსდება სტატიკურ საიტზე. Node სერვერს ცალკე HTTPS ჰოსტინგი სჭირდება; `chat.js`-ში `API_BASE` მიუთითეთ მისი URL, სერვერზე კი `ALLOWED_ORIGIN` — საიტის origin (ბილიკის გარეშე). არსებული about/contact გვერდები ამ პაკეტში არ შედის. სერვერი ადგილობრივი გადახედვისთვის 127.0.0.1-ზე უსმენს; ჰოსტინგზე მოარგეთ მისამართი პლატფორმის მოთხოვნას. საჯარო გაშვებამდე დააყენეთ პროქსის შესაბამისი შეზღუდვები და API ხარჯების ლიმიტი; არსებული ლიმიტი ერთი პროცესის მეხსიერებაშია.

ჩატში გაგზავნილი ტექსტი გადაეცემა OpenAI-ს; ისტორია გვერდის მეხსიერებაში ინახება და განახლებისას იშლება. საბოლოო თანხას AI არ ადგენს — სერვერი ამოწმებს დადასტურებულ პროფილსა და მონაცემებს და ტარიფით ითვლის. AI-ის მიერ ამოკითხული მონაცემები მომხმარებელმა ფორმაში უნდა გადაამოწმოს.

API წყარო: https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses

## Firebase integration
See [Firebase setup and current activation status](docs/firebase-setup.md). The public website now uses Firebase when configured; the earlier Node CMS setup below is an alternative.

