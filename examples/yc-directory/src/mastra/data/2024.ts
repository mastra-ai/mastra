const YC_DATA = [
  {
    name: 'Asha Health',
    longDescription:
      'Asha Health enables medical practices to launch their own AI clinic, designed to fill crucial care gaps that their brick & mortar clinics are too overburdened to address — all while generating additional revenue on autopilot.',
    tags: 'Health Tech, Healthcare, AI',
    industries: 'Healthcare',
    batch: 'F24',
  },
  {
    name: 'Bifrost Orbital',
    longDescription:
      "At Bifrost Orbital, we're building the future of satellite connectivity. Our mission is to eliminate communication blackouts and dead spots in orbit by providing an always-on, continuous connectivity service for satellites and other spacecraft in low Earth orbit. We're building an optical relay network of satellites to provide 24/7 uplink and downlink support to other satellites in orbit, with increased uptime and higher data rates for TT&C and more.",
    tags: 'Satellites, Aerospace, Telecommunications',
    industries: 'Industrials, Aviation and Space',
    batch: 'F24',
  },
  {
    name: 'HumanLayer',
    longDescription:
      'HumanLayer is an API that enables AI applications to contact humans for help, feedback, and approvals. One customer uses HumanLayer to ship DevOps agents that manage complex and risky workflows like production deployments and database migrations.  We’re building HumanLayer because we know that the future of AI Applications is not gonna be humans sitting at a chat interface, the future is “outer loop” or “headless” agents, and our partners are building AI apps that invert the typical interaction paradigm. Autonomous agents are calling humans, not the other way around. AI Agents are poised to disrupt the $4.6tn global labor market, but in order to make agents reliable today, and train them to be fully autonomous tomorrow, solutions like HumanLayer are an inevitable part of the AI Agent stack. ',
    tags: '',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'F24',
  },
  {
    name: 'Fabricate',
    longDescription:
      "Hardware engineers spend a quarter of their time just figuring out how to get their parts made, and from who. Fabricate builds procurement software for hardware teams. We help engineers manage manufacturing feasibility and procurement across their suppliers, whether they're getting parts custom manufactured or buying them off-the-shelf.",
    tags: 'Artificial Intelligence, B2B, Manufacturing',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'F24',
  },
  {
    name: 'Roundabout Technologies',
    longDescription:
      'Roundabout Technologies makes AI-powered traffic lights, allowing cities to reduce pedestrian deaths, improve traffic, and reduce resident complaints. Our founding team has experience building safety-critical embedded systems and AI at Waymo, Zoox, Google, and Verily.',
    tags: 'Hardware, SaaS, GovTech, Computer Vision, Transportation',
    industries: 'Government',
    batch: 'F24',
  },
  {
    name: 'Synth',
    longDescription:
      "You add a few decorators to your agent code, and run your agent on a dataset of questions you've generated / collected in the wild. We give you back a dataset of message triplets that's ready to be uploaded to your fine-tuning provider of choice (OpenAI, OpenPipe, Anthropic, Gemini, etc) that will give you a language model ready to steer your agent in production more effectively.",
    tags: 'Artificial Intelligence, Reinforcement Learning, Infrastructure',
    industries: 'B2B, Infrastructure',
    batch: 'F24',
  },
  {
    name: 'Helpcare AI',
    longDescription:
      'Helpcare builds AI Workers for healthcare orgs to take on coordination burden from staff and reduce time of care by autonomously identifying and outreaching patients (through phone, text, email, & mail) to schedule visits, book screenings, complete pre-post, and onboard.  These agents require no integration, can navigate all tools, speak 29 languages, come with 50+ outreach scripts and have a remarkable 80% conversation-to-booking closing rate.',
    tags: '',
    industries: 'Healthcare, Healthcare IT',
    batch: 'F24',
  },
  {
    name: 'Canvas',
    longDescription:
      'Canvas is the AI-copilot for enterprise customer success teams. By automatically surfacing and addressing the most critical risks and growth opportunities, we transform CSMs from reactive support managers into proactive growth drivers.',
    tags: 'SaaS, Customer Success, Analytics, Enterprise, AI',
    industries: 'B2B, Analytics',
    batch: 'F24',
  },
  {
    name: 'Ember Copilot',
    longDescription:
      "At Ember, we're tackling one of healthcare's most costly and overlooked challenges: the massive inefficiency in clinical documentation and revenue cycle management. Medical practices lose billions annually due to incomplete documentation, missed billing opportunities, and denied claims - issues that stem from antiquated systems that force clinicians to choose between patient care and paperwork. We combine ambient listening technology with deep understanding of medical billing requirements to eliminate the administrative burden that plagues healthcare providers.",
    tags: '',
    industries: 'Healthcare',
    batch: 'F24',
  },
  {
    name: 'Relvy AI',
    longDescription:
      "Relvy does 24x7 monitoring of production software logs to both discover and debug issues. We do this using our custom LLMs that are 200x cheaper than frontier models, which means we are the only AI that's usable at the scale of this problem.",
    tags: 'Developer Tools, SaaS, B2B, DevOps, AI',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'F24',
  },
  {
    name: 'Friday',
    longDescription:
      "Email sucks. It takes forever to go through, and hiring an assistant is costly and invasive. Friday is building the assistant that learns how to predict the action that you will take on your emails, and does it for you. Today's email products try to help you go through your emails a little faster, but if you have to get through 1000 emails, those products doesn't do much for you.  The reality is, most of the emails you get don't require you to personally look at them. Friday completely eliminates the need to check those emails, and handles them all at once for you, immediately.  Friday is here to file away spam, sift through newsletters for important tidbits, text you important notifications, and reply to mundane emails, so that no matter how many thousands of emails are in your inbox, you'll just be left with the few emails that actually require your personal touch. Getting this right is difficult, so everyone else settles with trying to help you go through your email twice as fast. If you want to go 100x as fast, you shouldn't spend even a second on useless emails.  Friday gets this right, bringing the elite experience of having a professional assistant to the entire world.",
    tags: 'Artificial Intelligence, Productivity, Email, AI Assistant',
    industries: 'Consumer',
    batch: 'F24',
  },
  {
    name: 'SRE.ai',
    longDescription:
      'SRE.ai provides AI Agents to power Low-Code DevOps for Low-Code Platforms like Salesforce, SAP, NetSuite, etc.',
    tags: 'Developer Tools, B2B, DevOps, Infrastructure, AI',
    industries: 'B2B, Infrastructure',
    batch: 'F24',
  },
  {
    name: 'Ryvn',
    longDescription:
      "Ryvn manages the infrastructure for your applications in your cloud or your customer's cloud. We handle deploying and rolling out updates, provide aggregated logging and monitoring, and offer one-click rollbacks. Expand into regulated industries, accelerate time-to-PoCs, and boost revenue by offering on-prem/self-hosted without the added complexity. Build once, deploy anywhere.",
    tags: 'AIOps, Developer Tools, SaaS, DevOps, Infrastructure',
    industries: 'B2B, Infrastructure',
    batch: 'F24',
  },
  {
    name: 'Melder',
    longDescription:
      "Melder is a spreadsheet tool that has AI functions and data representations at its core. Upload files directly to cells, use functions like =GEN, and build automations directly from the workbook. We make it easy for business users to uncover insights in their documents, automate away their emails, and even deploy simple AI chatbots. 'Excel' is the backbone that codifies structured data business logic today, we're taking that UX to the unstructured data world.",
    tags: 'Generative AI, Data Engineering, AI',
    industries: 'B2B, Operations',
    batch: 'F24',
  },
  {
    name: 'Fix AI',
    longDescription:
      'Fix AI automates frontend QA testing using AI agents that simulate real users on websites. With simple natural language prompts, e.g. "make sure the onboarding flow works", our agents walk through flows and visually interact with the site to ensure critical bugs never reach users.',
    tags: 'Artificial Intelligence, Developer Tools, AI',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'F24',
  },
  {
    name: 'Foundry',
    longDescription:
      'Foundry is the world model for your AI agent, empowering companies to build and productionize agents that automate entire workflows—like customer support, recruiting, and sales—and productionize them in minutes/hours, not weeks/months.  With Foundry, teams can quickly create agents that actually work, track performance, and scale their impact across the business. Pranav and I built AI systems at Scale AI for companies like OpenAI. Now, we’re bringing that experience to teams everywhere to make AI agents accessible and practical for every business.',
    tags: 'Developer Tools, Workflow Automation, No-code, Automation, AI',
    industries: 'B2B, Infrastructure',
    batch: 'F24',
  },
  {
    name: 'Forerunner AI',
    longDescription:
      'Forerunner is your aerospace, defense, and hardware engineering copilot, helping you beat tight deadlines by automating critical engineering workflows. Our secure AI agents access data from tools like Atlassian Suite and Microsoft Office, then collaborate with hardware engineers to accelerate design and analysis.',
    tags: 'Artificial Intelligence, Manufacturing, Aerospace',
    industries: 'Industrials, Aviation and Space',
    batch: 'F24',
  },
  {
    name: 'OpenClinic',
    longDescription:
      "OpenClinic is a platform that makes it easy for any doctor or hospital to open their own digital clinic. Our AI assistant takes a comprehensive medical history using an empathic voice-based interface, uses sophisticated medical reasoning to narrow down likely diagnoses, and produces evidence-based treatment suggestions for each patient. Licensed doctors then review the text-based summaries of the cases our AI provides, and choose how to manage the patients. In this fashion, we're able to deliver end-to-end healthcare where AI manages 99%, and doctors do the final high value 1%. ",
    tags: 'Health Tech, Digital Health, Healthcare',
    industries: 'Healthcare',
    batch: 'F24',
  },
  {
    name: 'Bramble',
    longDescription:
      "Bramble is a video-first search platform for real estate, powered by AI. It helps agents auto-generate beautiful video listings and helps buyers search videos of homes for what they actually care about, like natural light or a big yard. We launched as a flat-rate real estate brokerage. After helping customers close on $10M worth of homes, we learned that lead generation is the biggest problem in real estate. By helping agents market their listings with videos and allowing buyers to find homes visually, we'll disrupt property search sites like Zillow.",
    tags: 'Artificial Intelligence, Real Estate, Consumer, Proptech, Consumer Products',
    industries: 'Real Estate and Construction, Housing and Real Estate',
    batch: 'F24',
  },
  {
    name: 'Surge',
    longDescription:
      'Surge is Stripe for telephony. Our team has experience building telephony software at billion dollar scale. Because of increased regulation, Twilio and other SMS APIs take weeks to onboard new customers, but we can get startups onboarded same day. Surge will win the market by enabling easy carrier registration and keeping customers with our higher level APIs and no code UI components. We have 11 paying customers so far, and our revenue is growing 58% month over month.',
    tags: '',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'F24',
  },
  {
    name: 'Sunset',
    longDescription:
      'Sunset can track down bank accounts, retirement accounts, investment accounts, property and more for families after losing a loved one. Sunset will close those accounts and move the money into a Sunset estate account to manage.',
    tags: 'Fintech, Consumer Finance',
    industries: 'Fintech, Consumer Finance',
    batch: 'F24',
  },
  {
    name: 'ArchiLabs',
    longDescription:
      "ArchiLabs is building an AI co-pilot for architecture. Instead of spending hours on tedious tasks, architects can 10x their design speed with simple AI prompts. Brian and William met at Carnegie Mellon as engineers and separately had their own frustrating new construction experiences. Brian ran a tech-enabled homebuilding factory and found the design iteration process to be a massive bottleneck, while William built ground up homes in Texas and had a similar frustration. However, at the time, there wasn't an easy solution to the many pain points in the design process. As AI reasoning models improve, Brian and William realized that there was a massive opportunity to fix the long-tail of frustrations and build a new construction design experience by fine tuning existing models, becoming bigger than Autodesk, the $60B company in the space.",
    tags: 'Artificial Intelligence, SaaS, Construction, B2B, Proptech',
    industries: 'Real Estate and Construction, Construction',
    batch: 'F24',
  },
  {
    name: 'Revi',
    longDescription:
      'Revi helps Investment Banks, PE firms, and Corporate Development teams source new deals. We do this by using agentic workflows to replicate their end-to-end deal origination process, entirely removing the trade-off between precision and scalability. We released the first version of Revi in September 2023 and now have companies like KPMG and platforms backed by KKR and Nordic Capital using our product.',
    tags: '',
    industries: 'B2B, Sales',
    batch: 'F24',
  },
  {
    name: 'Metreecs',
    longDescription:
      'Metreecs helps retailers plan, buy, and allocate products using AI-demand forecasting. We prevent overstock and out-of-stock situations, allowing clients to eliminate waste, free up capital, and drive higher sales.',
    tags: 'Artificial Intelligence, Machine Learning, Retail Tech',
    industries: 'B2B, Retail',
    batch: 'F24',
  },
  {
    name: 'Diffusion Studio',
    longDescription:
      'Diffusion Studio is Canva for video editing, we allow anyone to import video footage they have taken and our AI will generate a publish-ready video. We have achieved this only now because we replace heavyweight desktop apps with the newly released WebCodecs and WebGPU web APIs, that enable hardware-accelerated encoding in the Browser.',
    tags: 'Artificial Intelligence, Consumer, Video, Media, AI',
    industries: 'Consumer, Content',
    batch: 'F24',
  },
  {
    name: 'Chorrie',
    longDescription:
      "Chorrie is a no-code platform that puts AI in the hands of medical billing teams to prevent denied and under-billed insurance claims.  We use LLMs to empower billing teams to turn their manual claim QA into automated correctness checks.  Co-founders Chris and Jorrie are MIT computer science grads and went on to work at Google, where they used similar applied AI techniques to automate content moderation workflows and prevent real-world threats.  Within a month of launching with our first client, an ophthalmology practice with 8 clinics and 4 surgery centers, Chorrie has already flagged over $300k of claims that were either under-billed, or would've been denied.  Learn more at www.chorrie.com.",
    tags: 'Generative AI, SaaS, B2B, Healthcare, Billing',
    industries: 'Healthcare, Healthcare Services',
    batch: 'F24',
  },
  {
    name: 'Alex',
    longDescription:
      "Tired of switching tabs to cursor every time you're building your iOS app in Xcode? Worry not! Alex is a sidebar app that works directly with Xcode, and has the same Cmd+L, Cmd+K, and Apply Code commands as Cursor. And, it's super fast. Check it out: https://alexcodes.app",
    tags: '',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'F24',
  },
  {
    name: 'Gander',
    longDescription:
      'Gander is bringing LLMs to the airline industry starting with customer service. Our first products help airlines automate the process of calculating compensation for flight disruptions and baggage issues, while our proactive voice agent calls customers to get them on a new flight when they are delayed or cancelled.',
    tags: 'Artificial Intelligence, SaaS, Customer Support',
    industries: 'B2B, Operations',
    batch: 'F24',
  },
  {
    name: 'Innate',
    longDescription:
      'Innate is developing innately intelligent teachable general-purpose robots. Our platforms are simple, accessible, so as to lower the barrier to entry into robotics for everyone.',
    tags: 'Generative AI, Hard Tech, Robotics, Consumer, AI Assistant',
    industries: 'Consumer, Consumer Electronics',
    batch: 'F24',
  },
  {
    name: 'Scrapybara',
    longDescription:
      'Scrapybara provides virtual computer environments for AI agents. We deploy, scale, and maintain remote desktop instances that agents like Claude Computer Use can interact with via an API.',
    tags: '',
    industries: 'B2B',
    batch: 'F24',
  },
  {
    name: 'Consus',
    longDescription:
      'Consus is your single source of truth for government specifications, standards, or handbooks. We verify the active revision of documents, notify you when documents are updated, and make it easy to extract the relevant information. Win new business or execute existing contracts faster with Consus.',
    tags: '',
    industries: 'Industrials, Aviation and Space',
    batch: 'F24',
  },
  {
    name: 'CollectWise',
    longDescription:
      "CollectWise automates consumer debt collection with AI. We’re outperforming collection firms by 2X and have successfully serviced over $2 million in debts. Our platform handles the entire late-stage recovery process, allowing creditors to recover debts that couldn’t be resolved through voluntary communications. CollectWise's AI agents automate pre-legal outreach, asset research, litigation, credit reporting, and enforcement actions like garnishments and liens.",
    tags: '',
    industries: 'Fintech',
    batch: 'F24',
  },
  {
    name: 'Origami Agents',
    longDescription:
      "Every Origami Agent works like a dedicated human sales rep, analyzing websites, press releases, and product pages to bring you the top 1% of your customers every day. Use millions of Origami Agents to make sense of the other 99% of data that's not in structured databases. ‎  Previously, Finn built custom outbound solutions for over 20 startups, while Kenson was the CTO at an enterprise sales startup. We found ourselves building this tool for our customers over and over again, and that it worked 10x better than all other outbound strategies. ‎  There’s enough information on the internet to know exactly who your perfect customers are.",
    tags: '',
    industries: 'B2B, Sales',
    batch: 'F24',
  },
  {
    name: 'Fresco',
    longDescription:
      'Fresco helps construction superintendents take 1000s of pages of notes, 10x faster. We automate the process of completing progress notes and punch lists, reducing time requirements from hours to minutes. Superintendents simply record videos of their site walk, and Fresco pulls out the relevant information and formats it into rich reports. We also offer one-click integrations with leading project management software like Procore and ACC, for maximum usability.',
    tags: 'Construction, Compliance, Note-taking, AI Assistant',
    industries: 'Real Estate and Construction, Construction',
    batch: 'F24',
  },
  {
    name: 'PermitPortal',
    longDescription:
      'We are building workflows to help developers go from finding and closing development sites to getting a building permit faster. PermitPortal accelerates the most critical parts of the pre-construction phase: finding the right sites, understanding entitlements and navigating local development sentiment. ',
    tags: 'Real Estate, Construction, AI',
    industries: 'Real Estate and Construction',
    batch: 'F24',
  },
  {
    name: 'Gecko Security',
    longDescription:
      'We built Gecko for teams that want to build secure code quickly without wasting time on security tools that don’t deliver results, or relying on one-time human pentests that quickly become outdated. Gecko uses AI to understand how your application should work, simulates relevant attacks to find critical vulnerabilities, and then verifies these vulnerabilities by exploiting them. It also helps you understand the risk of these vulnerabilities and applies a working fix to keep your code secure.',
    tags: 'Artificial Intelligence, SaaS, B2B, Security, Cybersecurity',
    industries: 'B2B, Security',
    batch: 'F24',
  },
  {
    name: 'Autumn',
    longDescription:
      'Autumn is an abstraction layer between your database and Stripe that lets you build any pricing plan and control feature entitlement.',
    tags: 'SaaS, B2B, Billing',
    industries: 'B2B',
    batch: 'F24',
  },
  {
    name: 'Curo',
    longDescription:
      "Curo enables electric vehicle fleets to lease EV chargers. We do this by providing a standardized process so that any EV charger owner can host a fleet, such as an office building overnight when their employees go home. Owners of EV chargers get <15% usage after paying hundreds of thousands of dollars to install, and fleets are rapidly trying to electrify yet charging is a huge bottleneck. Curo increases revenue 5x for charger owners and enables fleets to electrify instantly, at a fraction of the cost.  We're live across 5 states, having grown 50% MoM for the past 6 months. Curo is already backed by investors like Blue Bear, Not Boring, Slow and Eniac. ",
    tags: 'Transportation, Energy, Automotive',
    industries: 'Industrials, Automotive',
    batch: 'F24',
  },
  {
    name: 'Dexter',
    longDescription:
      "Dexter is the AI workflow automation tool for field operations. With Dexter, customers reduce traffic fines, automate van management, and run asset recovery. We're the only tool that can hand-off tasks between the back office, in-field workers, and AI agents. ",
    tags: 'SaaS, B2B, Workflow Automation, Automation, Operations',
    industries: 'B2B, Operations',
    batch: 'F24',
  },
  {
    name: 'Moonshine',
    longDescription: '',
    tags: 'Machine Learning, Video, Media',
    industries: 'B2B, Analytics',
    batch: 'F24',
  },
  {
    name: 'Abundant',
    longDescription:
      'Abundant powers reliable and safe AI deployment with real-time human expertise. Our network of specialized operators works alongside AI agents to: (1) Handle complex edge cases with precision. (2) Maintain rigorous safety standards. (3) Generate high-quality training data that continuously improves AI performance. Companies can meet stringent quality requirements at a fraction of the cost of in-house teams, while accelerating their AI initiatives.',
    tags: 'AIOps, Developer Tools, Recruiting, Collaboration, AI',
    industries: 'B2B',
    batch: 'F24',
  },
  {
    name: 'AutoComputer',
    longDescription:
      'AutoComputer is a desktop robotic process automation system.  Given just a text prompt, our AI automates tedious tasks such as financial data entry by performing all the clicks and keystrokes for you.',
    tags: 'Deep Learning, B2B, Enterprise, Automation, AI',
    industries: 'B2B',
    batch: 'F24',
  },
  {
    name: 'Crustdata',
    longDescription:
      'Crustdata provides live company and people data via APIs. We make hard to get data easy to use at scale. We have developed technology that allows us to pipe in live data from over a dozen different data sources and deliver this data instantly to our customers.  We serve use cases like: automatic pipeline building, pipeline prioritization, champion watching, company and people triggers for sales and marketing automation, investment deal sourcing Our goal is index all the important data on the web and deliver it to customers in an easy-to-use way.',
    tags: '',
    industries: 'B2B, Sales',
    batch: 'F24',
  },
  {
    name: 'Tiny',
    longDescription:
      'At Tiny, we’re building a new kind of ERP system for factories where AI agents automate repetitive workflows. Made for the four million factories still primarily relying on Excel. LLMs now unlock their troves of siloed unstructured data. We see a massive opportunity to build a compound startup and, beyond that, tap into network effects to unlock just-in-time manufacturing across entire supply chains.',
    tags: 'SaaS, B2B, Workflow Automation, Manufacturing, Enterprise Software',
    industries: 'B2B',
    batch: 'F24',
  },
  {
    name: 'vly.ai',
    longDescription:
      'vly.ai completely replaces the full-stack developer for companies. We combine the highest-ranking swe-bench agent with a no-code platform to eliminate the developer layer and automate the deployment, hosting, & scaling of production applications.',
    tags: 'Artificial Intelligence, SaaS, Enterprise Software, Web Development',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'F24',
  },
  {
    name: 'Pearson Labs',
    longDescription:
      'Pearson builds AI agents to automate corporate transactions. Large law firms use us to run gigantic books of businesses with AI, reducing their cost of delivery 40-60%. We work with Orrick as our first design partner, starting with M&A due diligence and financings. $3-6T dollars flow through corporate transactions a year and lawyers take home 1-3% as their cut for every transaction ($150B / year). In the long run, we will capture 50% of the corporate transaction market with the top 30 law firms. We will then provide our AI to companies so they can execute these transactions themselves.',
    tags: 'Generative AI, Legal, LegalTech, AI',
    industries: 'B2B, Legal',
    batch: 'F24',
  },
  {
    name: 'Cekura',
    longDescription:
      'Cekura is an AI web agent that ensures SaaS product documentation stays up-to-date. We help knowledge and customer success teams save 100+ hours per week.',
    tags: 'Artificial Intelligence, Customer Success, Customer Support, Enterprise, Automation',
    industries: 'B2B',
    batch: 'F24',
  },
  {
    name: 'Platus',
    longDescription:
      'Platus delivers fast, reliable legal infrastructure with a no-code platform and API, designed to support SMBs with instant access to notarization, legal drafting, e-signing, and workflow automations. Our solution removes the high costs and slow processing of traditional legal services, by empowering businesses to seamlessly manage compliance and legal tasks.',
    tags: 'B2B, Workflow Automation, Compliance, LegalTech, AI',
    industries: 'B2B, Legal',
    batch: 'F24',
  },
  {
    name: 'Aditto',
    longDescription:
      'Aditto lets you launch and manage AI generated ads and landing pages at scale. Founders and executives use Aditto to do the work of a whole search engine marketing team in minutes.',
    tags: 'Artificial Intelligence, Marketing, Advertising',
    industries: 'B2B, Marketing',
    batch: 'F24',
  },
  {
    name: 'BeerMe',
    longDescription:
      'BeerMe is a digital wallet for USDC. It’s like Venmo or Cash App, but we use stablecoins to make sending money instant, global, and free. A peer-to-peer electronic cash system is the crypto use-case, but the technology remains inaccessible to mainstream users. Today, after 15 years of innovation, it is finally possible to build a digital wallet that puts crypto into a billion people’s hands, without them even realizing it.',
    tags: 'Crypto / Web3, Payments, Consumer, Messaging, Social Media',
    industries: 'Consumer, Social',
    batch: 'F24',
  },
  {
    name: 'HYBRD',
    longDescription:
      'HYBRD is Strava for modern athletes who do more than just cardio. It brings all your training data together by integrating with top wearables and uses AI to make tracking weightlifting easy. This allows athletes to fully understand their training load, track holistic progress over time, and compete with friends in fresh, exciting ways. Existing products tend to focus on only one type of exercise—either cardio or strength—leaving hybrid athletes juggling disconnected tools. As hybrid athletes themselves the founders found this frustrating and set out to build the unified approach they needed for their training. Three of HYBRD’s founders previously worked at WHOOP, each leading teams across product, growth and analytics. In parallel, Mats was a member of the US national rowing team and Ben, Shoe and Ruiters have all completed Ironman 70.3s. ',
    tags: 'Consumer, Fitness, Social, Digital Health, AI',
    industries: 'Consumer',
    batch: 'F24',
  },
  {
    name: 'Codebuff',
    longDescription:
      "Chat with Codebuff to edit your codebase. It's a coding agent that can iterate and run terminal commands, just like a real engineer! We are going up-market from Cursor, starting at a $49/mo price point. Codebuff chooses files to read automatically on each message, which improves its awareness of your codebase and saves you time. It has full access to your terminal — Codebuff can run terminal commands to install packages, run tests, check for type errors, etc. It's the most powerful coding agent on the market that also happens to be the easiest to use. Codebuff is an engineer working for you. Run `npm install -g codebuff` to get started.",
    tags: '',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'F24',
  },
  {
    name: 'Karmen',
    longDescription:
      'Karmen is an AI assistant for construction project managers. We integrate with their emails, project management software and ERPs to automate admin tasks like invoice processing and approvals. One construction company we are working with faced a project delay cost of around $50,000 a day from an invoicing mistake. Supplier management issues like these account for 20% of project delays. ',
    tags: 'Machine Learning, Construction, AI Assistant',
    industries: 'Real Estate and Construction, Construction',
    batch: 'F24',
  },
  {
    name: 'Replexica',
    longDescription:
      'Replexica automates the localization process end-to-end. It produces authentic translations instantly and eliminates translation management and manual work. Our AI generates pull requests with translations when developers commit UI code changes, avoiding the typical back-and-forth with translation agencies. This helps teams do localization 100x faster, ship to production more often, without bottlenecks.',
    tags: 'Developer Tools, B2B, Open Source, International, AI',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'F24',
  },
  {
    name: 'Sphinx',
    longDescription:
      'Sphinx automates the manual work of compliance analysts. Our AI agents make AML decisions, helping banks and fintech eliminate onboarding bottlenecks. ',
    tags: '',
    industries: 'Fintech',
    batch: 'F24',
  },
  {
    name: 'Luthor',
    longDescription:
      'Luthor is an AI-powered copilot for marketing compliance. We scan all your marketing content in real-time to flag risky language and suggest fixes, ensuring you adhere to regulations from agencies like the FTC, FDA, and SEC. With Luthor, you can manage your marketing efforts confidently, knowing your content remains compliant.',
    tags: 'Artificial Intelligence, B2B, Marketing',
    industries: 'B2B, Marketing',
    batch: 'F24',
  },
  {
    name: 'Keye',
    longDescription:
      ' Keye is an AI software that lets private equity firms do due diligence for acquisitions faster and more accurately. Our customers can evaluate 10x more deals and fund better companies which leads directly to better returns/more alpha. -- Our system is the first of its kind to instantly generate complex, comprehensive data packs from raw data in any format, directly from the data room. This enables investors to gain an 80% understanding of a potential deal within moments, empowering them to say No to a deal earlier in the process and focus on high-potential opportunities. Traditionally, creating these detailed data packs—like cohort or retention analyses and customer roll-forwards—takes weeks, during which critical details may be overlooked, potentially costing funds millions in missed insights and poor decisions. -- Keye combines cutting-edge AI with deep private equity expertise to deliver powerful, multi-layered insights that go far beyond the simple summarizers and search functions offered by other tools. Our platform dives deep into both quantitative and qualitative due diligence data, offering high-impact analytics crafted specifically for private equity workflows. This isn’t just automation—it’s a purpose-built solution that uncovers actionable insights, fueling smarter decisions and driving true alpha. ',
    tags: 'Artificial Intelligence, Finance, Investing, Enterprise Software, AI',
    industries: 'Fintech',
    batch: 'F24',
  },
  {
    name: 'RiskCube',
    longDescription:
      'RiskCube is an AI-driven insurance broker for Property & Casualty (P&C) risks. Insurance agents use RiskCube to identify specific risks, such as floods and hurricanes, and help businesses secure the most relevant insurance policies. Our platform empowers agents to sell more policies in less time by leveraging AI-driven insights. ',
    tags: 'Fintech, SaaS, B2B, Insurance',
    industries: 'Fintech, Insurance',
    batch: 'F24',
  },
  {
    name: 'CTGT',
    longDescription:
      'CTGT is building the next evolution of AI, towards intelligence that is foundationally designed to be efficient and trustworthy. Our enterprise-grade platform prevents AI hallucinations and errors in real-time while maximizing ROI. Based on seminal research that opens the "black box" of AI, we enable Fortune 500 companies to deploy AI with confidence through automated risk prevention, comprehensive audit trails, and institutional-grade security controls. With AI adoption surging to 72%, we help organizations avoid costly mistakes and reputation damage while achieving 99.99% reliability and 10x faster deployment times. Trusted by industry leaders and backed by prominent investors, CTGT transforms AI from a liability into a competitive advantage.',
    tags: 'Artificial Intelligence, Deep Learning, SaaS, B2B, Enterprise',
    industries: 'B2B, Infrastructure',
    batch: 'F24',
  },
  {
    name: 'StudyDojo',
    longDescription:
      'StudyDojo is building the AI study platform students actually obsess over. We use AI to transform familiar study tools - question banks,  study notes, mini-lessons - into personalized learning experiences that adapt to each student, tailored to their curriculum.',
    tags: '',
    industries: 'Education',
    batch: 'F24',
  },
  {
    name: 'ISSEN',
    longDescription:
      'ISSEN is an AI conversational language app that helps you become fluent. Your on-demand voice tutor is personal to you, adapting lessons and chats to your particular interests, learning style, and goals. Our mission is to transform language learning by offering a level of connection, effectiveness and fun that, until now, only human teachers could provide.',
    tags: 'Education, Generative AI, Consumer, AI',
    industries: 'Consumer',
    batch: 'F24',
  },
  {
    name: 'Protegee',
    longDescription:
      'We’re excited to launch our first product that allows your AI voice agents to accept payments easily and securely over the phone. We manage compliance, security, and fraud, letting you focus on creating great experiences.   We are setting the stage for the agentic economy, starting with voice payments. Web and agent-to-agent transactions coming soon.',
    tags: 'Fintech, Payments, Infrastructure, Trust & Safety, AI',
    industries: 'Fintech, Payments',
    batch: 'F24',
  },
  {
    name: 'Circlemind',
    longDescription:
      'Circlemind is developing the next-generation of memory systems for AI that surpasses current Retrieval Augmented Generation (RAG) methods. Our technology based on Knowledge Graphs and PageRank, allows for efficient, interpretable, and context-aware reasoning and retrieval.',
    tags: 'Artificial Intelligence, Deep Learning, Developer Tools, Generative AI, SaaS',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'F24',
  },
  {
    name: 'Reticular',
    longDescription:
      'Reticular helps pharma companies discover drugs with AI models like AlphaFold by making them steerable, just like you can prompt LLMs. Today, limited validation data means companies spend millions on failed experiments trying to steer these models through trial and error. We’re piloting our AI interpretability technology with early-stage biotechs and scaling rapidly. Just a week after our pivot, we identified the first interpretable features ever found in protein models, allowing precise control over biological functions. Nithin and John met competing in Biology Olympiads before spending 4 years as roommates at MIT publishing ML/bio research in NeurIPS and Nature. We believe biological models encode far more information than anyone is currently using - our goal is to unlock this potential.',
    tags: 'AI-powered Drug Discovery, Generative AI, Biotech, Therapeutics',
    industries: 'Healthcare, Drug Discovery and Delivery',
    batch: 'F24',
  },
  {
    name: 'Astrix Health',
    longDescription:
      'Astrix builds AI purchasing agents for healthcare providers. Astrix agents normalize and aggregate billions of data points on medical supply pricing allowing providers to make informed purchasing decisions.',
    tags: 'Artificial Intelligence, Machine Learning, Collaboration, Healthcare, Supply Chain',
    industries: 'Healthcare',
    batch: 'F24',
  },
  {
    name: 'Lune AI',
    longDescription:
      'A replacement to standard LLMs for coding tasks - eliminate hallucinations with a marketplace of expert LLMs trained on hundreds of technical topics.',
    tags: 'Developer Tools, AI, AI Assistant',
    industries: 'B2B',
    batch: 'F24',
  },
  {
    name: 'Vocera',
    longDescription:
      "Are you building AI voice agents like receptionists, customer support, or sales reps? Do you find yourself manually testing your bot by calling it? We faced similar challenges, especially being in a regulated industry. That's why we developed Vocera - a solution that automates the testing process for your voice agents. With Vocera, you can prove your reliability before going live, test every update seamlessly, and scale your operations efficiently. Replicating a real world conversation is hard. Our AI simulates these scenarios using workflows, personas and past conversations. We are already talking to AI for ordering food, getting appointments and even interviews. The market is aptly getting flooded with AI voice agents built by thousands of companies. We make them dependable.",
    tags: '',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'F24',
  },
  {
    name: 'Regatta Storage',
    longDescription:
      'Regatta transforms S3 buckets into a 30x faster, unlimited, local disk. Regatta enables AI, analytics, and serverless applications to instantly access massive data sets without waiting for data transfer. Researchers use Regatta for shareable, local storage of data set and model versions that never runs out of capacity.',
    tags: 'Developer Tools, Big Data, Cloud Computing, Infrastructure, AI',
    industries: 'B2B, Infrastructure',
    batch: 'F24',
  },
  {
    name: 'Sandra AI',
    longDescription:
      'Sandra AI builds AI employees for car dealerships and auto repair shops, starting with AI receptionists. Dealerships miss 30% of customer calls, leading to 45% of customers switching dealerships and up to $2M in annual lost revenue per dealership. Sandra AI operates 24/7, handling calls, emails, and texts, and directly schedules appointments, ensuring no opportunity is lost.   As the first voice AI fully integrated with key dealership systems, Sandra AI is uniquely positioned to capture a significant market.   Within two weeks of launch, Sandra AI signed 22 dealerships. The founding team is composed of ex-McKinsey who graduated from Ecole Polytechnique, MIT, and HEC Paris.',
    tags: 'Automotive, AI Assistant',
    industries: 'B2B',
    batch: 'F24',
  },
  {
    name: 'Vespper',
    longDescription:
      'Vespper is an AI agent running 24/7 to troubleshoot your alerts by surfacing the right data at the right time. It helps teams reduce downtime and alert fatigue by making sure no alert falls through the cracks again.  ',
    tags: 'AIOps, Developer Tools, B2B, DevOps, AI Assistant',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'F24',
  },
  {
    name: 'Praxis AI',
    longDescription:
      "Praxis AI builds manufacturing specific agents capable of reasoning and processing complex situations. Our engineering copilot predicts and prevents machine failures in real time by solving problems the same way an engineer would. Our agents have access to and make sense of the structured and unstructured data that exists at factories including machine sensor data, maintenance manuals and work orders. Our simplified interface enables manufacturing teams with minimal AI knowledge to create custom complex workflows on the machinery they know is critical to their operations. Early results have shown that Praxis can help manufacturers reduce their unplanned production downtimes by as much as 25%.  Existing solutions focus on dashboards and complex charts. We know that dashboards don't cut costs, actions do.",
    tags: 'Artificial Intelligence, IoT, Manufacturing, Data Science, AI Assistant',
    industries: 'Industrials, Manufacturing and Robotics',
    batch: 'F24',
  },
  {
    name: 'Revyl',
    longDescription:
      'Revyl is an observability platform that automatically catches and triages bugs before they reach production.',
    tags: 'Artificial Intelligence, Developer Tools, B2B, Infrastructure',
    industries: 'B2B, Infrastructure',
    batch: 'F24',
  },
  {
    name: 'supercontrast',
    longDescription:
      'At Hive we worked on a product called Gencraft, an ai art generator we ramped from 0 to $1M ARR in 6 months. This inspired us to build supercontrast, an AI Copilot which empowers anyone to create and refine high quality designs and assets. ',
    tags: 'Machine Learning, Design, Design Tools',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'F24',
  },
  {
    name: 'Raycaster',
    longDescription:
      "Raycaster helps companies sell complex technical products by surfacing hidden insights about their prospects. Our customers use us to automatically uncover everything from lab equipment specifications to API performance metrics - research that traditionally took weeks of manual digging. What's exciting is how these insights naturally spread. Teams start with sales, then realize their product and strategy teams need this deep customer understanding too. We're building the intelligence layer that helps technical teams make better decisions.",
    tags: '',
    industries: 'B2B, Sales',
    batch: 'F24',
  },
  {
    name: 'Lightscreen AI',
    longDescription:
      "Lightscreen’s voice + video AI interviewer enables companies to identify and invest in genuinely skilled candidates. It's already being used by high-growth startups and recruiting agencies to screen technical candidates.  We provide companies with a voicebot that can run a full-length technical interview, does smart interruptions, and multi-modal cheating detection. The AI provides the company rubric-based, rich candidate evaluation in minutes and can be fully customized to ask questions and evaluate based on the company's needs. ",
    tags: 'Artificial Intelligence, SaaS, Recruiting, Talent Acquisition, Conversational AI',
    industries: 'B2B, Recruiting and Talent',
    batch: 'F24',
  },
  {
    name: 'Afternoon.co',
    longDescription:
      'Afternoon.co empowers founders to make better business decisions with real time financial metrics. We pair managed AI bookkeeping and tax services, to reduce administrative burden on founders.  Accountants struggle serving 4 million+ of ecommerce brands & startups in the US, because of complexity in sales tax, multiple sales channels and inventory management. We automate a large portion of bookkeeping by integrating with their sales and inventory systems, so founders can spend less time doing admin work. ',
    tags: 'SaaS',
    industries: 'B2B, Finance and Accounting',
    batch: 'F24',
  },
  {
    name: 'Rulebase',
    longDescription:
      'We build AI agents that protect fintechs and banks from account takeovers, impersonations, and phishing attacks, while also automating fraud investigations. Our AI agent  gathers and analyzes all the necessary evidence, reducing the average investigation time from 30 minutes to just 2 minutes. ',
    tags: 'FinOps, Finance, Fraud Prevention, Fraud Detection',
    industries: 'B2B, Operations',
    batch: 'F24',
  },
  {
    name: 'HealthSpark',
    longDescription:
      'HealthSpark empowers physical therapists to launch and run an AI-native independent practice by automating admin tasks like insurance, scheduling, handling calls and texts, and charting.',
    tags: 'Artificial Intelligence, Health Tech, Digital Health, Healthcare, AI',
    industries: 'Healthcare',
    batch: 'F24',
  },
  {
    name: 'OpenFunnel',
    longDescription:
      'OpenFunnel builds personalized AI Agents for GTM teams. These agents understand their product, scour through the internet, and find prospects that have shown intent for their product. Today, GTM teams at B2B SaaS companies, burn through cold prospects from intent data providers like Demandbase and Zoominfo using some AI SDR tools and get conversions < 1%. Our customers have a steady pipeline of prospects daily and get 20x more meetings booked by reaching out to prospects when they show intent. ',
    tags: 'Generative AI, B2B',
    industries: 'B2B, Sales',
    batch: 'F24',
  },
  {
    name: 'Coblocks',
    longDescription:
      'Coblocks is a thoughtfully-designed data platform that helps teams write queries and automate workflows faster.  We understand the columns, tables, and relationships in your data and use them to help anyone on your team build pipelines with AI, SQL and Python. Think of us like Zapier plus Cursor for data engineering. Here’s how we’re different: • All-in-one: You can get started in 2 minutes – no setup or configuration required. We have one-click integrations, warehousing, transformation, and schedules all built in. • Seamless integrations: Plug in your Postgres database, Stripe transactions, Hubspot leads, or any other data source, without writing code to keep things in sync. • Thoughtful AI: We love Cursor and we love data – we combined the two to help you write accurate queries. We use existing metadata to help you create new datasets, connect sources, fix errors, or edit in place. • Collaborative: Easily share data and discover what others in your org have built as a starting place for your analysis. Wrap common blocks of logic with templates so your team never has to start from zero. • Resilient and Scalable: Our compute engine is lightning-fast for queries and builds. Git and branching are built-in for both code and data, so you can time-travel backwards when things break. You can start with GBs and grow to TBs.',
    tags: 'Artificial Intelligence, Analytics, Data Science, Big Data, Data Engineering',
    industries: 'B2B, Infrastructure',
    batch: 'F24',
  },
  {
    name: 'Getcho',
    longDescription:
      'Getcho is a local delivery platform for high-value goods.  We are building a high-reliability delivery network on top of high-volume, unreliable fleets, just like how TCP builds reliable end-to-end networking on top of an unreliable base network (IP).',
    tags: 'SaaS, Delivery, Logistics, E-commerce, Retail Tech',
    industries: 'B2B, Supply Chain and Logistics',
    batch: 'F24',
  },
  {
    name: 'Encore',
    longDescription:
      'Encore is your go-to online shopping assistant for finding secondhand treasures. Our conversational search platform makes it easy and fun to browse platforms like Depop, eBay, Grailed, and Poshmark—all in one place. Whether you’re after styling tips, honest reviews, trend ideas, or tracking down that cool piece you saw in a movie or on social media, we’ve got you covered. Shopping should feel like having a personal expert by your side, helping you discover things you’ll truly love. With Encore, browsing becomes easy, fun, and actually rewarding.',
    tags: 'Artificial Intelligence, Consumer, Retail Tech',
    industries: 'Consumer',
    batch: 'F24',
  },
  {
    name: 'Summed AI',
    longDescription:
      'Summed AI is an AI assistant that digs up accurate Medicare policy details for you 90% faster, so you can enroll your clients quicker with fewer compliance dings.',
    tags: 'B2B, Insurance, AI',
    industries: 'B2B, Sales',
    batch: 'F24',
  },
  {
    name: 'Gait',
    longDescription:
      "Ever been confused by a block of AI-generated code? Gait is a Cursor and VS Code extension that will let you view the prompt that generated code. Continue off of your coworker's conversations, view analytics on your AI codegen use, and more!",
    tags: 'Developer Tools, AI',
    industries: 'B2B',
    batch: 'F24',
  },
  {
    name: 'Durate',
    longDescription:
      'We make software to automate call shift scheduling for hospital residents/faculty and generally help hospital administrators keep track of their departments. Hospitals have long lists of requirements and rules they must follow, leading administrators to spend hundreds of hours a month ensuring their departments adhere to guidelines.',
    tags: 'SaaS, Healthcare, Healthcare IT',
    industries: 'Healthcare, Healthcare IT',
    batch: 'F24',
  },
  {
    name: 'Upshift',
    longDescription:
      'Upshift is tooling for plugin systems. We help product companies support extension points, which enable them and their users to build and share additional functionality on top of their core product offerings. Extensibility with Upshift drives more sales, better retention, and compounds value over time. Up until now, only the biggest companies have had the resources to build these types of systems because it can take years and massive upfront engineering investment to ship something. We cut the time-to-production down to weeks. And this will open up previously inaccessible possibilities for mid-sized businesses and fast-growing startups. We know how to build it. For more than six years, Adam and Thomas have worked together as eng leaders, mastering our system integration expertise from Palantir and Candid Health. Our biggest win included converting an $823 million contract vehicle for the US Army, overhauling their entire data fabric.',
    tags: 'Developer Tools, SaaS, B2B',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'F24',
  },
  {
    name: 'PearAI',
    longDescription: 'The Open Source and Extendable AI Code Editor: https://trypear.ai. ',
    tags: 'Developer Tools, Open Source, Culture, AI',
    industries: 'Consumer',
    batch: 'F24',
  },
  {
    name: 'Symphony',
    longDescription:
      'Symphony helps enterprises train their customer-facing employees using interactive AI voice simulations of real-world scenarios. Users can create an infinite number of simulations that allow their teams to practice the job - avoiding costly mistakes with real customers. For example, we’re live with 2 of the top 3 auto insurers in NA, helping train 1000s of newly hired claims adjusters. ',
    tags: 'Artificial Intelligence, SaaS, B2B, HR Tech',
    industries: 'B2B',
    batch: 'F24',
  },
  {
    name: 'telli',
    longDescription:
      'telli is building AI voice agents that convert leads into sales opportunities for B2C companies. For example, a leading home-buying platform is using telli to fully automate their pre-qualification. We are serving customers in energy, real estate, medical products, and home services. You might think that these B2C companies want to do more self-serve and less outreach. But the truth is outbound calls are what really drive conversion. Historically, managing these calls has been complex and expensive—costing companies hundreds of thousands of dollars. With telli, for the first time, B2C companies can automate the role of a pre-sales agent, end to end.',
    tags: 'Artificial Intelligence, SaaS, B2B',
    industries: 'B2B',
    batch: 'F24',
  },
  {
    name: 'ShowAndTell',
    longDescription:
      'ShowAndTell creates AI agents for dental patient operations. Our agents educate patients, boost case acceptance, and build lasting trust. We enable dental staff to focus on patient care rather than patient operations.',
    tags: 'Generative AI, Health Tech, Dental, AI',
    industries: 'Healthcare',
    batch: 'F24',
  },
  {
    name: 'Galini',
    longDescription:
      'Galini guardrails-as-a-service filter harmful inputs and outputs based on company policies and industry regulations. We make it easy for enterprises to create, test, deploy and refine guardrails. With Galini, product and engineering leaders enjoy peace of mind knowing their AI apps are compliant at run-time, and save $1-10M in costs from avoiding in-house build',
    tags: 'Artificial Intelligence, SaaS, B2B, Compliance, Enterprise',
    industries: 'B2B',
    batch: 'F24',
  },
  {
    name: 'Riveter AI',
    longDescription:
      "Riveter is the copilot for corporate strategy. We help growth stage companies like Gusto accelerate strategic decision making, using deep market research and analysis.  Riveter's analysis includes extraction and segmentation of data from 10-Ks, Investor Day decks, and other official sources. We go beyond Capital IQ to extract and calculate key company-specific metrics like gross margins, CAC, CAC payback period, ACV, customer counts, and more. Dive deeper into company documents and Riveter data with Peter, our AI Analyst.",
    tags: 'Artificial Intelligence, B2B, Analytics, Market Research, AI',
    industries: 'B2B, Analytics',
    batch: 'F24',
  },
  {
    name: 'Andoria',
    longDescription:
      'Andoria is an AI web agent that generates in-app walkthroughs for software companies. The AI agent learns how your web application works, gathers data about your user (e.g. background & goal), and generates a custom walkthrough whenever a user needs help. When a user gets stuck, Andoria can step in, and show them exactly what to do by performing such actions. Andoria’s goal is to bring each user to “activation” from day 1. The best part: setup is only pasting a script tag into your HTML & Andoria takes it from there.',
    tags: 'Artificial Intelligence, Generative AI, B2B, Customer Support, ML',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'F24',
  },
  {
    name: 'fixa',
    longDescription:
      'Fixa is the Sentry for AI voice agents. Companies like 11x and OfOne use us to run simulated tests, analyze production calls, and fix bugs in their voice agents.  We were both voice agent developers at PlayHT – and, in order to find bugs in our agents, we would spend countless hours manually calling them and listening to conversation recordings. So, we’ve decided to build a platform that does this automatically.  Fixa shows developers exactly where and how their agents mess up – enabling them to pinpoint root causes and fix them faster. ',
    tags: 'AI, AI Assistant',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'F24',
  },
  {
    name: 'Leeroo',
    longDescription:
      'Leeroo empowers developers and organizations to turn complex workflows and ideas into production-ready AI systems. Our platform enables the creation of end-to-end trainable Compound Models that combine pre-trained models, tools, and data seamlessly. Not only do we automate model building but also automate the integration of tools and data sources, accelerating the journey from concept to deployment. By abstracting complexity, we allow users to focus on solving problems, not building infrastructure, and deliver scalable, customizable, and fully private solutions.',
    tags: 'Artificial Intelligence',
    industries: 'B2B',
    batch: 'F24',
  },
  {
    name: 'Variant',
    longDescription:
      'Variant is building the state-of-the-art model for software design. Our first milestone, icon generation, already surpasses existing approaches. The company is founded by Ben South Lee, former VP of Product Design at unicorn companies Postmates ($5B exit) and Avara ($2.5B market cap), and Daniel Bulhosa Solórzano, Staff ML engineer at Square and Cruise.',
    tags: 'Artificial Intelligence, Developer Tools, Design Tools, AI',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'F24',
  },
  {
    name: 'Outerport',
    longDescription:
      'Outerport helps AI read documents the way humans do - building up understanding section by section and checking facts along the way, instead of just matching similar phrases. For example, when a team needs to confirm a specific requirement in a 200-page compliance policy document, Outerport pinpoints the right section, provides the reasoning, and presents a fact-based summary. Outerport is built for performance- run thousands of queries against your critical documents, with reasoning behind every retrieval. No more faulty vector RAG.',
    tags: 'AIOps, Artificial Intelligence, Developer Tools, SaaS, Infrastructure',
    industries: 'B2B, Infrastructure',
    batch: 'S24',
  },
  {
    name: 'DreamRP',
    longDescription:
      'DreamRP lets users chat with character chatbots made by the content owners themselves. For example, users could chat with Jon Snow bot made by George R. R. Martin.  Character chat is the most engaging social category ever - more than YouTube, Instagram, or TikTok. But all the current chatbots are fan-made knock-offs and do not have deals with the actual content owners, whose IP they are stealing.  We’re building the first fully legal character chat platform that shares revenue with the content owners.',
    tags: 'Artificial Intelligence, Generative AI, Consumer, Entertainment, AI',
    industries: 'Consumer',
    batch: 'S24',
  },
  {
    name: 'Melty',
    longDescription:
      "We're building Chorus, a Mac app that lets you chat with O1, Claude, Perplexity, Deepseek, and others on your desktop. Find the right model for each task, get more creativity without copy–pasting prompts, and get more reliability without manually comparing model outputs.",
    tags: 'Developer Tools, Generative AI, AI',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'S24',
  },
  {
    name: 'Syntra',
    longDescription:
      'Syntra is the all-in-one solution for private practice doctors. Our operating system includes a personalized EHR that automates administrative tasks for doctors, such as patient intake, scribing, billing, and inventory management.  Practices are switching off of solutions they have used for over a decade, calling Syntra "the only solution that doesn’t need to be managed.”',
    tags: '',
    industries: 'Healthcare, Healthcare IT',
    batch: 'S24',
  },
  {
    name: 'PathPilot',
    longDescription:
      'PathPilot makes it easy to understand what your users are experiencing by extracting key highlights from hours of session replay videos. + Quickly see how users interact with new features + Uncover hidden UI issues + Ensure smooth experiences for top customers + Receive recommendations for UI improvements ',
    tags: '',
    industries: 'B2B',
    batch: 'S24',
  },
  {
    name: 'Standard Data',
    longDescription:
      'Standard Data builds interactive copilots for highly skilled manufacturing roles. U.S. manufacturing is in crisis. Despite surging growth, by 2030 the United States will have 4 million unfilled roles. Automation will not be capable of replacing these skilled roles - to create a safe, prosperous future, we must secure the next generation of manufacturing talent.',
    tags: 'Education, Recruiting, Manufacturing',
    industries: 'B2B',
    batch: 'S24',
  },
  {
    name: 'Kairo Health',
    longDescription:
      'Kairo Health builds AI agents that help deliver patient care at a fraction of the cost. The US has a shortage of nurses, care coordinators, and administrators, all of whom spend a significant portion of their days navigating disparate software systems like their EHR and waiting on hold for hours over the phone. Organizations have little incentive to grow these teams, which leads to burnout and inefficiency. Kairo scales this support staff by recording their actions and translating them into instructions for our agents to execute on their own. Organizations can deploy these agents for any care delivery workflow, such as calling patients to check-in on their symptoms, rescheduling a clinician’s panel in case of an emergency, and filling late cancellation slots with other patients.',
    tags: 'Digital Health, Healthcare IT, AI',
    industries: 'Healthcare, Healthcare IT',
    batch: 'S24',
  },
  {
    name: 'Midship',
    longDescription:
      'We extract and organize structured data from documents, such as PDFs, excel sheets for non-engineers. A CRE firm uses us to pull data from several deals to populate their underwriting spreadsheets in 5 minutes, instead of hours.',
    tags: 'Documents, B2B, AI, AI Assistant',
    industries: 'B2B, Finance and Accounting',
    batch: 'S24',
  },
  {
    name: 'Soma Lab',
    longDescription:
      'Soma Lab creates simulated conversations with AI patients to scale healthcare training. Students and providers practice with AI patients to build skills and get evaluated.',
    tags: 'AI-Enhanced Learning, Education, Healthcare, Edtech, AI',
    industries: 'Healthcare',
    batch: 'S24',
  },
  {
    name: 'Merlin AI',
    longDescription:
      "Merlin is an AI-powered ERP for construction companies.  We provide construction companies with a single, AI-powered platform to manage their entire business operations. Our platform unifies project management, materials management, finance, estimating, and CRM—traditionally scattered across multiple systems—into one cohesive solution. For the first time, construction firms can automate and oversee every aspect of their projects in a single, intuitive system. Today, construction companies pay for 8-17 different tools - that we eliminate the need for.  We reduce  - Manual work by 60% - Cut software costs by $10,000 monthly - Complete projects 3x faster.  Why Now? We're witnessing a perfect storm of factors: decades of stagnation in traditional ERP systems, a multi-billion-dollar industry built on misaligned incentives, and the transformative potential of AI. This confluence creates a rare cyclical opportunity for market upheaval. The last major shift in this space occurred in the 1990s with the advent of digital systems, and now, 30 years later, we're on the cusp of another seismic change. Customers are crying out for innovation and as AI reshapes the landscape, early customer signals indicate an eagerness for smarter, more efficient systems. It's a unique window of opportunity that opens perhaps once in a multi-decade chance to redefine an entire industry's operational backbone. Team: KS, a BITS Pilani grad and successful startup co-founder, and Ayantika, an IIT alumni and tech expert, bring extensive coding and product development expertise together bringing about over a decade of technical expertise. Sneha ( that’s me), with over a decade of experience in supply chain management and lean manufacturing within the construction industry, has lived the pain of using ERPs in this industry.",
    tags: 'SaaS, Construction, B2B, Enterprise Software, AI',
    industries: 'B2B',
    batch: 'S24',
  },
  {
    name: 'Freestyle',
    longDescription:
      'Ben and Jacob met in Calculus class in 10th grade, and tried founding a startup in high school — it didn’t go anywhere, but it taught them a ton. During high school, Ben lead the frontend team for the World Health Organization’s COVID-19 App Team. After high school, Jacob went to Apple and Ben went to college. When there was an opening on his team, Jacob had Ben apply, and Ben left UChicago to go work at Apple. They spent about 2 years at Apple as Senior Engineers in the Conversational Engineering Department, before leaving to found Freestyle. Freestyle is directly inspired by what they saw as their failures of the tech they worked with at Apple.',
    tags: 'Developer Tools, Open Source, Web Development, Cloud Computing',
    industries: 'B2B, Infrastructure',
    batch: 'S24',
  },
  {
    name: 'Arva AI',
    longDescription:
      "Every time a business onboards onto a bank or fintech a human analyst has to conduct manual document verification. We replace those human KYB (know your business) analysts with AI agents that handle cases in seconds, not days. Currently, 30% of know your business (KYB) cases result in manual review work. With Arva's AI agents the whole end-to-end onboarding experience is automated. Instant onboarding whilst reducing operational costs by 80%. Our end goal is to have a whole suite of AI workers that can handle manual compliance work for banks and fintechs. A $24B opportunity in the US alone.",
    tags: '',
    industries: 'B2B',
    batch: 'S24',
  },
  {
    name: 'Affil.ai',
    longDescription:
      "We help companies like Capital One work with their affiliate content creators like CNBC more easily. Affiliate is an important growth channel, accounting for 25% of new credit card sign-ups, but today's financial companies use multiple layers of middleman to do their affiliate marketing and adhere to compliance guidelines.  This is costly and time consuming for fintechs and affiliates alike in this massive market.  Affil leverages AI to automate affiliate compliance, monitoring, and management to wrap the middleman into major player. This not only makes it easier for fintechs to market their products, but it also helps improve the affiliate experience as well. ",
    tags: 'SaaS, B2B, Compliance, Marketing, AI',
    industries: 'B2B, Marketing',
    batch: 'S24',
  },
  {
    name: 'OrgOrg',
    longDescription:
      'OrgOrg is a suite of apps that keeps teams productive and healthy regardless of the size of your organization. Founded by the creator of Zenter (YC 07, acquired by Google and became Google Slides), OrgOrg is designed to be a natural extension of Google Workspace Apps to help run organizations collaborate better leading to higher productivity. Today the suite includes apps like:    • Go links: Go links allows anyone in the org to easily name any link so team members can jump directly to the information that matters most: go/sales, go/production, go/anything-you-want. • Profiles with Personality: OrgOrg profiles are as insightful as they are delightful. They not only show you the expected org chart data, but also highlight accomplishments, how you like to work, and who you are as a person. • Goal tracking: Track, share, and collaborate on "big rock" goals on the cadence that makes sense for your team from daily to annually. • Branded New Tab: Keep the team focused the next major milestone, broadcast announcements, and keep important links top of mind every time a new browser tab is opened. • All Hands Q&A: Crowdsource questions, anonymously if desired, for large team meetings to make sure everyone\'s voice is heard, and the most top of mind questions are answered and recorded. • Smart Groups: Create rules based groups of people and use them to make sure the right people are in the right conversations and have the right access. For example, anyone with the title of "Software Engineer" should be in the #eng slack channel and eng@ google group. • On-call: Schedule smart rotations that take into account balancing the load and using signals from calendar schedules to make sure you don\'t waste time figuring out who can cover what in a fair way. Easily page the on-call from slack, API, or OrgOrg directly. • And more... All the tools you need so you can spend more time focusing on your core business, and less time focusing on the complexity that comes from running an organization.',
    tags: 'B2B, Productivity, Collaboration, Operations',
    industries: 'B2B, Productivity',
    batch: 'S24',
  },
  {
    name: 'Patched',
    longDescription:
      'Patched empowers development teams to build and deploy AI-assisted workflows that can autonomously complete post-code tasks like documentation, code reviews, and security patching. Our workflows can be customized using a visual builder and can be self-hosted with any AI model, enabling automation without compromising security, control, or compliance.',
    tags: 'Developer Tools, B2B, Open Source, AI',
    industries: 'B2B, Productivity',
    batch: 'S24',
  },
  {
    name: 'Village Labs',
    longDescription:
      "At Village Labs, we help America's businesses become employee owned by helping them set up and manage an employee stock ownership plan (ESOP).  ESOPs are a federal retirement plan that enable businesses to give their employees a stake in the company in exchange for significant tax benefits.  With 2.9M Baby Boomer business owners set to retire in the coming years, there's a growing \"Silver Tsunami\" of businesses across the country in search of new ownership. For many of these owners, selling to their employees is a socially-minded yet financially pragmatic solution. By selling ownership of their business to an ESOP, owners get a fair price, tax benefits, and the satisfaction of knowing their employees and legacy will be taken care of — things not guaranteed with traditional buyers like private equity. In turn, employees retain their jobs and get shares in the business that can help them create life changing wealth by the time they retire — imagine an office secretary retiring as a millionaire.  Thousands of businesses across America like Bob's Red Mill, Harpoon Brewery, and Recology already have an ESOP, benefiting over 14 million workers and creating 2.1 trillion in employee wealth. We're excited about the opportunity to massively grow these numbers by making it simple for every business to become employee owned.  ",
    tags: 'Fintech, Human Resources',
    industries: 'B2B, Human Resources',
    batch: 'S24',
  },
  {
    name: 'Mica AI',
    longDescription:
      'Mica builds AI Agents that automate B2B sales. Our agents analyze sales calls, generate tailored collateral, and follow up until the deal is closed. The founders met at UC Berkeley, and at our last jobs, we saw that the best sales reps weren’t just great at selling—they were elite content creators. They crafted tailored collateral like decks and highlight videos for each buyer, and their champions used this info to advocate for purchasing their product within their companies.  However, because this takes more than 30 minutes per call, even the best reps could only do tailored follow-ups for a few clients, leaving millions in lost deals. Mica’s agents reduce that time to less than a minute. This lets top performers do A+ work on every deal and helps the rest of the team sell like a top performer. Sales collateral creation and follow-up is a $11b market in the US but this is just our beachhead. We’ll ship a fleet of agents that automate and eventually replace every other facet of the $80b enterprise sales market.   ',
    tags: 'Artificial Intelligence, SaaS, Sales, Sales Enablement, AI',
    industries: 'B2B, Sales',
    batch: 'S24',
  },
  {
    name: 'Formula Insight',
    longDescription:
      'Formula Insight offers Institutional Investors previously inaccessible data. We provide a central repository of financial models so investors can track changes to forecasts, quantify projection accuracy and expedite analysis.  This further systematizes the investment process and enables better investment decisions.',
    tags: 'Fintech, SaaS, B2B, Workflow Automation, Enterprise Software',
    industries: 'B2B',
    batch: 'S24',
  },
  {
    name: 'Overlap',
    longDescription:
      'Overlap builds multimodal AI agents that can do literally anything you want related to video, such as finding specific moments, generating clips, or analyzing your video library.  What takes media companies thousands of hours, we do in seconds. ',
    tags: 'Consumer, Media, Podcasts, AI',
    industries: 'Consumer, Content',
    batch: 'S24',
  },
  {
    name: 'Capitol AI',
    longDescription:
      "As Perplexity or Gemini replaces the Google Search we all use today, it will remove the need to ever visit a website. This is an existential risk to all media brands, which is why Capitol went from zero to $1.68M in revenue during YC: all media companies need to offer THEIR OWN Perplexity-like experience to maintain their direct relationship with customers. The most trusted brand in political news and analysis, Politico, chose us to power their Politico Pro Subscription product. Consumers expect instant personalized answers. Publishers won’t build this on their own. Capitol’s API lights up publishers' websites and apps so their end users can generate personalized search results, cited research reports, and even tweet storms using the publisher’s proprietary data—all within their paywall.  Capitol is the new last mile of content delivery for publishing. This market is $16b in 2023, and will grow to $85.6b in 2030. Gemini and Perplexity are the imperial forces. Capitol is arming the rebels. ",
    tags: 'AI-Enhanced Learning, Artificial Intelligence, Workflow Automation, Analytics, Media',
    industries: 'B2B, Productivity',
    batch: 'S24',
  },
  {
    name: 'General Analysis',
    longDescription:
      'General Analysis provides a comprehensive suite of AI safety tools, including red-teaming frameworks, interpretability techniques, and more. As AI systems become increasingly capable, their deployment in high-stakes environments poses significant risks—financial, ethical, and otherwise—where errors can lead to substantial consequences. To address these challenges, we offer access to novel tools and methodologies designed to systematically find model failure-modes and enhance model robustness.',
    tags: 'Artificial Intelligence, SaaS, Trust & Safety',
    industries: 'B2B',
    batch: 'S24',
  },
  {
    name: 'Void',
    longDescription:
      'Void is an open source code editor with AI features similar to Cursor and GitHub Copilot. Unlike other tools, Void lets developers connect directly to open source LLM models without sending their private data through an external backend.',
    tags: 'Artificial Intelligence, Developer Tools, AI',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'S24',
  },
  {
    name: 'Anglera',
    longDescription:
      "At Anglera, we're developing a suite of AI agents to help e-commerce companies run their operations more efficiently. Our flagship agent helps our customers onboard, enrich, and manage their product data, reducing time per product from 15 mins down to 5 seconds. We previously developed ML to automatically enrich millions of products at Uber Eats, and we're now on a mission to automate the most common manual workflows for every e-commerce business.",
    tags: 'Machine Learning, SaaS, B2B, E-commerce, AI',
    industries: 'B2B, Retail',
    batch: 'S24',
  },
  {
    name: 'XTraffic',
    longDescription:
      'XTraffic is at the intersection of advancements in sensor technology and affordability. This means entire cities can affordably upgrade their infrastructure - and some already are. We are live in multiple cities, with both ongoing and successful pilots, corridors of multiple intersections, and soon to be entire cities. Our customers enjoy less traffic, better safety, and data on which to build their future.',
    tags: '',
    industries: 'Government',
    batch: 'S24',
  },
  {
    name: 'Felafax',
    longDescription:
      'Felafax is building AI infra for non-NVIDIA GPUs. With our ML experience from Google and Meta, we built a new AI stack that is 2x more cost-efficient and performant without needing Nvidia’s CUDA.',
    tags: 'Artificial Intelligence, Infrastructure, AI',
    industries: 'B2B, Infrastructure',
    batch: 'S24',
  },
  {
    name: 'Henry',
    longDescription:
      'Henry is an AI copilot for commercial real estate (CRE) brokers that seamlessly integrates a brokerage’s internal data set with external sources to generate custom presentations and financial modeling for deals. Our mission is to help CRE brokers close more deals faster, earning more while doing less repetitive work. We’re initially focusing on enabling brokers to generate deal decks in seconds—a task that typically consumes 20+ hours a week across multiple departments within a brokerage.',
    tags: 'Generative AI, SaaS, Real Estate, AI, AI Assistant',
    industries: 'Real Estate and Construction',
    batch: 'S24',
  },
  {
    name: 'Hey Revia',
    longDescription:
      'Hey Revia is a voice AI that handles complex phone calls for healthcare providers. Our software automates complex menus, reduces hold times, and handles tedious phone calls—verifying provider details, updating insurance info, and securing approvals. We offer Revia as web app, mobile app and API.',
    tags: 'Healthcare, Call Center, AI Assistant',
    industries: 'B2B',
    batch: 'S24',
  },
  {
    name: 'Ficra',
    longDescription:
      "Ficra enables product teams to ship higher quality releases, faster.  Ficra is the source of truth for every product screen and user flow, giving companies real-time visibility into what their users actually see in their live product. Ficra's AI provides a live, visual map of your users’ journeys: every screen, flow, A/B test, push notification and email.  With Ficra, product teams no longer waste 25% of their time auditing complex user flows to assess product quality and find the blind spots in funnels.",
    tags: 'Artificial Intelligence, B2B, Workflow Automation, Productivity, Design Tools',
    industries: 'B2B',
    batch: 'S24',
  },
  {
    name: 'RowBoat Labs',
    longDescription:
      'RowBoat Labs offers pre-trained LLM agents for customer support, which continuously learn from usage. Our LLMs are safe and brand-aligned. RowBoat agents seamlessly integrate into your systems and take actions where necessary.',
    tags: 'Generative AI, B2B, API, Customer Support, Conversational AI',
    industries: 'B2B',
    batch: 'S24',
  },
  {
    name: 'Pipeshift',
    longDescription:
      'Pipeshift is the "Vercel for open-source LLMs", offering a platform for finetuning, distilling, and inferencing open-source LLMs for engineering teams to get to production with their LLMs 10x faster. With Pipeshift, companies making >1000 calls/day on frontier LLMs can use their data and logs to replace GPT/Claude in production with specialized LLMs that offer higher accuracy, lower latencies, and model ownership. We are experts in LLMs, having scaled LLMs to 1000s of users in 2023. That\'s when we saw the massive drawbacks of closed-source LLMs in production, making us start Pipeshift. We met 6 years back as roommates during undergrad, and before starting Pipeshift, we led a defense robotics non-profit backed by NVIDIA and built a health-tech startup. The shift to AI is like the shift to the cloud, every company is going to implement AI. And, open-source AI will be as good as closed-source AI. Meta\'s Llama 3.1 models prove that. But, the open-source AI stack is a complete mess, with companies needing a team of engineers to set up 10+ different tools just to get started and every optimization needs countless engineering hours. Pipeshift offers this stack out of the box. With our fine-tuning + distilling platform and one-click deployment stack for hosting these LLMs, we ensure 10x faster experimentation cycles and time-to-production. Think "Vercel for open-source LLMs".',
    tags: 'AIOps, Artificial Intelligence, Generative AI, Infrastructure, AI',
    industries: 'B2B, Infrastructure',
    batch: 'S24',
  },
  {
    name: 'Vera Health',
    longDescription:
      'We empower healthcare providers, starting with emergency physicians, with instant access to up-to-date evidence-based answers. Our platform cuts through the noise to deliver trustworthy medical information 10x faster, revolutionizing clinical decision-support.',
    tags: 'Generative AI, B2B, Healthcare',
    industries: 'Healthcare, Healthcare Services',
    batch: 'S24',
  },
  {
    name: 'Pharos',
    longDescription:
      'Pharos automates hospital quality reporting, saving millions in labour costs and helping to prevent avoidable patient harm.  Today, clinicians spend thousands of hours manually pulling complex facts out of medical records for mandatory reporting and quality improvement. Our AI pulls those facts out of unstructured medical records automatically. We automate reporting and show staff where avoidable patient harm is happening.',
    tags: 'Health Tech, Digital Health, Healthcare, Healthcare IT, AI',
    industries: 'Healthcare, Healthcare IT',
    batch: 'S24',
  },
  {
    name: 'et al.',
    longDescription:
      'et al. is a mobile app that aggregates your newsletters, research papers, articles, and more, in one place. Think of it as an LLM-powered feed delivering you useful content in short insights. For example, if you’re building an AI voice agent, you’ll see the latest in speech-to-text models without having to actively search, go through a pile of research papers, or prompt an LLM. We extract key takeaways from long-form content - allowing you to read as little or as much as you like from the original piece of information. With et al., you get to stay on top of breakthroughs in your field, build knowledge, and discover new interests effortlessly.',
    tags: 'AI-Enhanced Learning, Consumer, Productivity, AI',
    industries: 'Consumer',
    batch: 'S24',
  },
  {
    name: 'Keet',
    longDescription:
      'Keet provides authentication for AI agents. Developers use us to connect their customers accounts and perform actions on their behalf.  Whether it be legacy software or consumer sites, Keet manages your users authenticated sessions and provides stable integrations on any web platform. Now your AI Agent can access healthcare data or send automated messages on LinkedIn via Keet’s API or SDK.',
    tags: 'Artificial Intelligence, Developer Tools, B2B',
    industries: 'B2B',
    batch: 'S24',
  },
  {
    name: 'Terra',
    longDescription:
      'Enter Terra, a new world of product building. Connect with suppliers, expedite sampling, and track production in real-time, removing the uncertainties of overseas manufacturing. ',
    tags: 'Manufacturing, Supply Chain, Procurement, Enterprise Software',
    industries: 'B2B, Supply Chain and Logistics',
    batch: 'S24',
  },
  {
    name: 'AI Sell',
    longDescription:
      "We're building AI Sales Associates for eCommerce. Imagine going on nike.com and facetiming an AI Lebron James and getting his advice on which his shoes to buy. Traditional brick-and-mortar retail stores rely on sales associates to provide personalized customer service, guide product discovery and close sales, but it's always been too expensive and unscaleable for online stores. We're building video-based AI agents that are experts in their products and can gently steer customers to a purchase, delighting customers and lifting conversion/AOV. Jerry and Jeffrey are brothers who previously worked together to scale The Coding School to a 6mil+ in revenue. Jerry built software to help run the 50+ Shopify brands that Openstore acquired more profitably and efficiently. He was also an engineer at Flexport and Google. Jeffrey previously worked at DRW as a quant trader, and as an engineer at Facebook, Snowflake and Amazon. ",
    tags: 'Sales, E-commerce, AI',
    industries: 'B2B',
    batch: 'S24',
  },
  {
    name: 'Diode Computers, Inc.',
    longDescription:
      'Diode automates hardware design, like hiring a senior electronic engineer for your projects. We use generative AI models to create and manufacture custom printed circuit boards in minutes, not weeks.',
    tags: 'Generative AI, SaaS, Manufacturing, Electronics',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'S24',
  },
  {
    name: 'SureBright',
    longDescription:
      'SureBright lets e-commerce merchants embed "Apple Care” like product warranties into their checkout flows in less than 10 minutes. Our AI-powered warranty platform generates incremental revenue and boosts customer loyalty at zero cost to the merchant. We earn a margin on each policy sold. Currently, we’re live with 60 merchants generating $22K in monthly revenue. We’ve booked an additional $50K of monthly revenue in signed contracts.  Sanket led engineering at PolicyBazar, an insurance tech company that IPOed and is valued at over $8B. Manish worked at Amazon and has built $100M ARR products, handling over 180B requests per day. Until now, finding the right policy for any product and pricing it at the right price wasn’t possible at scale. We automated this process using LLM and have unlocked a $50B+ opportunity. Each month, over 5 million consumers view SureBright warranty offers.',
    tags: 'Artificial Intelligence, Fintech, E-commerce, Insurance, Retail',
    industries: 'B2B, Retail',
    batch: 'S24',
  },
  {
    name: 'Usul',
    longDescription:
      'Usul helps companies win defense contracts with AI. Recent conflicts have forced the DoD to demand the next-generation of military technology. So we built software for US companies and our allies to collaborate and sell to the government. ',
    tags: 'GovTech, B2B, Procurement, Big Data, AI',
    industries: 'B2B',
    batch: 'S24',
  },
  {
    name: 'Saldor',
    longDescription: 'Asynchronous software engineering assistants.',
    tags: 'Artificial Intelligence, Generative AI',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'S24',
  },
  {
    name: 'Bucket Robotics',
    longDescription:
      "250M lbs of plastic is wasted annually in US manufacturing. Bucket Robotics is making defect detection faster and easier to deploy to prevent that. Our products are designed to be easy to integrate into existing automation and technology stacks, flexible enough to bring retooling costs down, and reliable enough to make you forget that it's a robot. Matt and Steph are leveraging their experience from the self-driving industry, where we've integrated high-performance computing and quality sensing into complex, noise-filled environments. We focus on robust hardware and user-friendly software for a new generation of end-users, ensuring ease of use and rapid deployment. Secure and efficient handling of user data can make customers in the manufacturing space nervous to invest in sensing — our team's extensive experience handling self-driving car data in these regulated environments positions us uniquely to tackle these challenges. Companies like Keyence, National Instruments, and FLIR offer either outdated hardware or prohibitively expensive systems, along with software that hasn’t evolved to meet modern user needs. US manufacturing is undergoing a significant transformation, with construction spending hitting a record annualized pace of over $200 billion. The need for a more reliable supply chain has seen over $700 billion in manufacturing megaprojects across North America since 2021, and this growth requires heavy automation. Bucket Robotics is at the forefront of this shift, offering a scalable, cost-effective solution that enhances automation and positions manufacturers closer to their end customers.",
    tags: '',
    industries: 'Industrials, Manufacturing and Robotics',
    batch: 'S24',
  },
  {
    name: 'Oway',
    longDescription:
      'Oway is a rideshare freight platform that uses machine learning to automatically coordinate and sell unused space in trucks to SMBs at a 50% discount for lightning-fast shipping.  Every year, nearly 50% all truck space goes unused annually in the almost $1T US trucking industry. On the other hand, SMBs represent 44% of the US GDP and are historically forced to deal with high freight rates and friction due to their small size compared to enterprise businesses.  With trucking being a hyper-fragmented market (90%+ of US trucking companies are small family businesses), we decided to build an ecosystem that takes all of this inefficiency and turns it into something that could fundamentally transform the livelihoods of businesses and drivers alike. Oway is designed to be simple (you can place an order in 30 seconds) and scale with your business. Our ML rideshare protocol now allows businesses to ship freight affordably and faster than ever before. We also improve the survivability of independent truckers by maximizing their revenue when they’re already on the road - and it’s great for the environment too. 🍃',
    tags: 'Machine Learning, Marketplace, B2B, Ridesharing, Logistics',
    industries: 'B2B, Supply Chain and Logistics',
    batch: 'S24',
  },
  {
    name: 'Elayne',
    longDescription:
      'Elayne empowers families to build generational wealth by automating estate planning and settlements on a single, unified platform. As the AI Executor, we manage the entire estate transfer process, facilitating $3 trillion in wealth transfers annually, with a ~3% take rate. Adria experienced this challenge firsthand after her mom passed away, leaving her to settle the estate while balancing her career. The process is currently entirely manual and takes an average of 400 hours over 18 months. Adria eventually burned out and resigned, which is when she realized that bereavement costs businesses $100 billion annually in lost productivity, absenteeism, and attrition. By addressing this problem through businesses, Elayne generates recurring revenue in an industry traditionally reliant on 1x transactions, while maintaining a lasting presence in the end user’s life. We directly alleviate the 43% increase in attrition following the death of a family member, while reducing overall costs for grieving families, democratizing estate support, and saving users hundreds of hours in financial, legal, and administrative tasks per loss.',
    tags: '',
    industries: 'B2B, Human Resources',
    batch: 'S24',
  },
  {
    name: 'Blaze',
    longDescription:
      "Blaze (YC S24) is global Venmo for cross border payments. It's a peer to peer payments app that uses USDC to make payments fast and cheap between any two people anywhere in the world. The founders scaled their last startup to $1M in ARR, studied mathematics and engineering at Duke, NYU, and Cornell, and have led teams at Spotify, Artsy, and Bitpanda. They're live in the US and Mexico, available for download on iOS and Android: https://blaze.money",
    tags: 'Fintech, Crypto / Web3, Payments, Finance, Travel',
    industries: 'Fintech, Payments',
    batch: 'S24',
  },
  {
    name: 'pap!',
    longDescription:
      "Consumers miss out on $70B+ every year because they're busy and unaware, and that money is sitting in their email inbox. So, we automated reading email receipts and claiming the money they're entitled to, offering a service to which you can sign up once, do (literally) nothing, and earn $. Where is this money coming from? - Retailers: When the price of clothes or furniture you've already bought drops, you're entitled to a refund for the difference - Airlines: When a flight you've booked gets delayed or canceled, you're entitled to a cash compensation. - Enterprises: When a class-action lawsuit is filed against a company you engage with, you're entitled to money. - And many more, that even the government holds some of your unclaimed funds. Today, the dream of one service that automatically claims the money you deserve when you shop, fly,... and live is (finally) possible. We started with automating refunds in the shopping industry and have secured $8,000 in refunds to our users, growing 233% MoM. With AI, we've been able to repurpose that same automation to tackle refunds in the flight industry and the class-action lawsuit landscape. Why us? (1) We're obsessed with reclaiming what's rightfully yours: Kamal and Anthony grew up in Lebanon, where people's money was unfairly taken away. (2) Weijie was the lead infra engineer for Wish's recommendation system, the feature that fueled their IPO. Our combined experience includes Apple, Addepar, Bolt, Wish, and StackAdapt. And we're all working towards one goal: move those billions of dollars where they belong. ",
    tags: 'Fintech, Consumer, Consumer Finance, AI Assistant',
    industries: 'Consumer',
    batch: 'S24',
  },
  {
    name: 'Mindely',
    longDescription:
      'Mindely is the first AI interviewer designed for skills assessment interviews.  Hiring for high volume, high turnover roles (e.g., consultants, analysts, sales & customer representatives) is time-consuming, inconsistent, and prone to unconscious bias. Managers spend valuable time on lengthy skill-based interviews instead of focusing on building candidate relationships or on driving company revenue.  Traditional AI interviewers don’t solve these issues – their rigid Q&A formats and one-size-fits-all approach can’t handle complex skill assessments. Mindely changes the game as the first AI interviewer built for in-depth case study, technical and role-play interviews. It:  - Simulates human interaction with real-time dialogue  - Challenges candidates with dynamic, adaptive responses  - Eliminates interviewer bias to create a fair, inclusive hiring process  - Works 24/7 to free up senior staff and widen talent pool  With Mindely, companies can rapidly customize and deploy human interviews at AI scale to test specific on-the-job skills.',
    tags: 'Generative AI, SaaS, Recruiting, HR Tech, Talent Acquisition',
    industries: 'B2B',
    batch: 'S24',
  },
  {
    name: 'TradeFlow',
    longDescription:
      'TradeFlow is AI-powered settlement for financial securities. During her time in financial services, Taryn saw firsthand how inefficient and costly it is to settle trades. Historically, it’s been difficult to improve this process because it’s heavily reliant on manual emails, disparate systems, and inconsistently structured data. However, the advent of powerful AI technology allows us to unlock greater automation than ever before. TradeFlow empowers back offices to do more with less by offloading these time-intensive tasks to AI.',
    tags: 'FinOps, Fintech, SaaS, B2B, AI',
    industries: 'Fintech',
    batch: 'S24',
  },
  {
    name: 'Voker',
    longDescription:
      "Voker is a no-code platform that empowers product teams to build AI features in minutes without involving engineers. Companies like Lull.com and Dutch.com are using our platform to improve their consumer experience and retention. Alex and Tyler met at a high-growth E-Commerce startup where Tyler was running Technology & Data. Together, they built AI products that bootstrapped the company profitably to $100MM in Revenue. Alex experienced firsthand the broken developer experience in AI while building enterprise infrastructure at Yardi. Even with a dedicated ML team, it took too much time to build simple AI features. It was clear that if large companies were struggling with this, SMBs would definitely be left behind. We went directly to our network of SMB operators and found our hunch was correct. Within a week we had two paying customers even before launching our first prototype. Voker is built for product specialists who know they can delight their users with AI but can't spend engineering bandwidth on building those features. By making AI accessible and practical, Voker helps these businesses profit from this new wave of innovation. ",
    tags: '',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'S24',
  },
  {
    name: 'Rastro',
    longDescription:
      "Rastro is a personal shopper for home decor. Our AI agents find you products from any retailer on the internet: we aim to build Perplexity for shopping. Built by ex-Shopify AI engineers, we're doing $25k monthly GMV with 15% margins. Decorating your home can cost tens of thousands for an interior designer, or involve hours of scrolling retailer sites. Tell Rastro about your vision, and send our agents to source for you. Receive dozens of products in minutes. Our agents understand your taste, and their picks convert 10 times better than classic e-commerce search.  Under the hood, we're building general purpose agents capable of sourcing products matching your taste and constraints from any retailer on the internet. Our algorithms consider images and descriptions, as well as product style, materials, brand and location. ",
    tags: 'Consumer, Retail Tech, Retail, AI',
    industries: 'Consumer',
    batch: 'S24',
  },
  {
    name: 'Quetzal',
    longDescription:
      'Quetzal is the first fully LLM-powered translation and internationalization suite, enabling companies to translate and internationalize their software and content instantly with minimal setup. We also handle all of your internationalization issues, from managing all of your stakeholders to bringing your product and marketing to market. No more waiting days or even weeks for translated content! Deliver a perfect experience to your users in any language, instantly.',
    tags: 'Artificial Intelligence, SaaS, Enterprise Software, International',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'S24',
  },
  {
    name: 'Typa - by Weavel',
    longDescription:
      'Typa automates inbound by posting authentic, everyday content crafted by AI. Simply chat with Typa and share your tasks, thoughts, or challenges - and AI generates content that sounds just like you, with your own insights incorporated. Watch your outreach grow on platforms like Twitter, LinkedIn, Bluesky, Medium, and more.',
    tags: 'Generative AI, B2B, Marketing, AI',
    industries: 'B2B, Marketing',
    batch: 'S24',
  },
  {
    name: 'Moreta',
    longDescription:
      'At Moreta, we simplify payments for international travelers, letting you pay for anything using just your phone. Say goodbye to the hassle of searching for the best cash exchange rates or ATMs on your next trip. With Moreta, paying local merchants is easy, and the best part? Transparent fees. We came up with Moreta while on our own backpacking adventures. Watching locals pay with a simple scan while we fumbled with cards and cash. So, we created a solution. By syncing with local payment networks, Moreta lets you pay like a local—securely and digitally—without needing a bank account in every country. We’re starting in Asia, where QR code digital wallets are taking over and are now the top choice at checkout. As these wallets start to join forces for cross-border payments, Moreta will be the first to bridge the gap for international travelers from card-centric markets to seamlessly tap into these local networks. Moreta will target 67 million travelers arriving in the region each year, who together have $127 billion in everyday expenditure.',
    tags: 'Fintech, Payments, Consumer, Travel',
    industries: 'Fintech, Payments',
    batch: 'S24',
  },
  {
    name: 'Focus Buddy',
    longDescription:
      'Reach out to us at founders@focusbuddy.ai Focus buddy is an AI productivity coach that stays on calls with you and help you accomplish your important work goals on a daily basis, even when you are struggling to focus. We noticed that our users develop a productive relationship with Focus Buddy. Users stay on calls for multiple hours everyday where they depend on Focus Buddy to: • Avoid procrastination and get started: Address hidden anxieties, embrace imperfection, chunk tasks, kickstart with mini-goals, and use regular check-ins to maintain momentum. • Recover from distractions and stay focused: Focus Buddy detects when they are working on less important tasks or scrolling on social media, help them overcome the underlying concerns feeding the distraction, and help them get back to the important task • Manage stress and Prevent Burnout: Focus Buddy detects stress buildup, integrates mindfulness habits to the workflow, helps take short rejuvenating breaks, and stay composed. Our Initial ICP is people with ADHD who are highly motivated but also highly blocked by internal and environmental factors. In the future, we believe each worker should have their own personal coach that enforces proven productivity techniques in real time to help them extract more focused hours every day with the same effort.  ',
    tags: 'Artificial Intelligence, Consumer, Productivity, Mental Health, Conversational AI',
    industries: 'Consumer, Content',
    batch: 'S24',
  },
  {
    name: 'Simplifine',
    longDescription:
      'Research workflows are broken, forcing researchers to cobble together disconnected tools for literature review, writing, data analysis, and more—tools not designed for their needs. Simplifine changes everything. Built by researchers, for researchers, it equips you with AI agents that act like JARVIS from Iron Man, capable not only of connecting and analyzing information but also running computational experiments and simulations. Our specialized LLM Agents can design and execute complex research experiments with PhD-level expertise, compressing weeks of work into minutes. With Simplifine, you no longer need to juggle fragmented tools—everything from advanced simulations to data analysis happens in one place.',
    tags: 'AI-Enhanced Learning, Productivity, Consumer Products, AI, Note-taking',
    industries: 'Consumer',
    batch: 'S24',
  },
  {
    name: 'Sepal AI',
    longDescription:
      "Sepal AI works with the world’s leading experts for developing advanced capability training data, expert annotations, and bespoke model evaluations.  Our team comes from Turing, Vercel, McKinsey, and Bain. At Turing, we built the LLM training business and products to support $100+M revenue for companies like OpenAI, Google, and Anthropic. We learned that data development for advanced AI use cases is more complex and has unique needs different from traditional label generation  Foundational AI companies and large enterprises that we worked with, like OpenAI, PepsiCo, and Johnson &Johnson, don't have the data they need to train models to produce value for highly technical use cases. Which means they’re not going to unlock the value from AI without a partner. We are working with the most influential companies of our time to develop models and systems that extend human knowledge and capabilities. ",
    tags: 'Data Labeling, AI',
    industries: 'B2B',
    batch: 'S24',
  },
  {
    name: 'Assembly HOA',
    longDescription:
      'We help HOAs manage their communities in a modern and transparent way. HOA boards choose Assembly to replace their existing management company, ensuring excellent service and clear visibility into their HOA’s finances and operations. With Assembly, community priorities are always addressed, and homeowners can easily understand what their HOA is doing and how their monthly dues are being used. Our mission is to create turnkey communities and protect property values through transparent, efficient, and proactive management. By combining top industry expertise with the latest in AI and fintech, we provide real-time financial insights, strategic community planning, and automated operations. Like many homeowners, Shreyas and Allen experienced frustrations with HOAs. Our investigation revealed that most HOA management companies are outdated mom-and-pop operations nearing retirement, resistant to adopting new technology. Furthermore, these companies often prioritize relationships with vendors and banks over the interests of the communities they serve, leading to misaligned incentives. Realizing this, we knew that to achieve our mission of fixing HOAs, Assembly HOA had to be vertically integrated. We are live with over 39 communities in Greater Los Angeles and SF Bay Area. ',
    tags: 'Artificial Intelligence, Fintech, Real Estate, Housing, Proptech',
    industries: 'Real Estate and Construction, Housing and Real Estate',
    batch: 'S24',
  },
  {
    name: 'autarc',
    longDescription:
      "With autarc we are building the OS for Europe's One-Stop Energy Installers. We are live with 400 customers and an ARR of $1.4 million. The problem: Energy installers are eager to expand their deployment of heat pump and photovoltaic systems, yet they are constrained by inefficient sales, planning, and installation processes. The solution: Our B2B software integrates CRM, planning, and design tools into a unified platform. This enables SMB installers to drastically cut down the pre-installation phase of home energy projects—from several weeks to just minutes. By leveraging LiDAR for spatial analysis, computer vision for automated assessment, and AI for system recommendations, we streamline the entire workflow. This results in a time reduction of up to 90%, enabling installers to confidently transition to and scale up sustainable home energy solutions.",
    tags: 'Artificial Intelligence, Lidar, Computer Vision, B2B, Climate',
    industries: 'B2B',
    batch: 'S24',
  },
  {
    name: 'omnidock',
    longDescription:
      'Expanding to other geographies and marketplaces is a massive growth lever for brands and manufacturers, but it’s complex and resource-intensive. Omnidock makes it effortless for merchants to sell on multiple marketplaces by acting as their merchant of record.  Brands simply plug into our operating system, which reads their catalog, assesses marketplace eligibility, and auto-launches their products through our pre-vetted marketplace accounts. We handle all transactions on their behalf, removing the challenges and complexities of multi-marketplace selling',
    tags: 'B2B, E-commerce',
    industries: 'B2B, Operations',
    batch: 'S24',
  },
  {
    name: 'Polymet',
    longDescription:
      'Polymet uses AI to help non-designers create production-ready designs and front-end code. They explain what they want or provide an image, and Polymet designs the interface. Our customers use Polymet instead of hiring designers and save thousands of dollars every month. Even their managers can design with English instead of writing design specs. This helps these teams move faster and cover design function on their own instead of contractors at early stages and when they start to scale their can produce a lot more design work, just like Midjourney.',
    tags: '',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'S24',
  },
  {
    name: 'Kontigo',
    longDescription:
      "We’re building Kontigo, a USDC Smart Neobank for Latinos in the U.S. and Latin America. We launched our Peer-to-Peer onramp 20 days ago and we’ve already had $540k in deposits, 10k active users and a +300k waitlist.  The founding team has built and scaled fintechs in Latam, and it’s ex-Venmo, Nubank, Rappi, MercadoLibre, Ualá, Platzi, and Yuno.  We’re already backed by DST Global, Soma Capital, Pioneer Fund, Transpose + 10 YC alums. Sending money to Latin America is just as painful as holding it due to the region's fragmentation into 33 countries with 39 different currencies.  On one hand, cross-border payments to Latam are absurdly expensive (up to 20% per transaction). Conversely, over the past decade, currency depreciation across the region has become unsustainable. (some countries surpassing the trillion percent ).  Kontigo solves this with a USDC global wallet & a BTC savings account.  - Like Venmo, but on-USDC. - Like Zelle, but for cross-border payments. No limits. - Like Nubank & Revolut, but without inflationary currencies. Bitcoin-backed. User wallets are connected to an AI-private banker on WhatsApp to execute international USDC transactions. ",
    tags: '',
    industries: 'Fintech, Banking and Exchange',
    batch: 'S24',
  },
  {
    name: 'Remo',
    longDescription:
      'Remo is building AI copilots for onboarding and compliance teams at financial institutions.  We automate highly manual processes like KYB and transaction monitoring.',
    tags: '',
    industries: 'Fintech',
    batch: 'S24',
  },
  {
    name: 'Propaya',
    longDescription:
      'Propaya uses AI to automate commercial lease abstractions and reviews. Propaya customers save 90% of lease review processing time and cost compared to before.',
    tags: 'Artificial Intelligence, Real Estate, Housing, Proptech',
    industries: 'Real Estate and Construction, Housing and Real Estate',
    batch: 'S24',
  },
  {
    name: 'Vendra',
    longDescription:
      'Vendra uses AI to automate project management and information lookup when working with vendors and suppliers - all with no change to existing workflows - letting hardware teams focus on building and shipping amazing products',
    tags: 'Hardware, SaaS, B2B, Collaboration, AI',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'S24',
  },
  {
    name: 'Argil',
    longDescription: '',
    tags: 'Generative AI, Social Media',
    industries: 'Consumer',
    batch: 'S24',
  },
  {
    name: 'ZeroPath',
    longDescription:
      'ZeroPath is a developer tool that autonomously detects, verifies, and submits fixes for vulnerabilities in your code. Engineers can use ZeroPath to find security problems that they might only otherwise catch in pentests or from bug bounty researchers.',
    tags: 'Developer Tools, B2B, Security, Cybersecurity, AI',
    industries: 'B2B, Security',
    batch: 'S24',
  },
  {
    name: 'Pumpkin',
    longDescription: 'Pumpkin is a new type of web browser built for daily collaboration with AI.',
    tags: 'Automation, AI',
    industries: 'Consumer, Home and Personal',
    batch: 'S24',
  },
  {
    name: 'Lumen Orbit',
    longDescription:
      "Lumen Orbit is building a network of megawatt-scale data centers in space, scaleable to gigawatt capacity, to be able to train large models like GPT6. Falling launch costs give us access to abundant energy, passive cooling, and the ability to rapidly scale in space. In Partnership with NVIDIA's Inception Program, we are launching our demonstrator satellite in May 2025, which will have 100x more powerful GPUs than have ever been operated in space. ",
    tags: 'Hard Tech, Satellites, Climate, Cloud Computing, AI',
    industries: 'Industrials, Aviation and Space',
    batch: 'S24',
  },
  {
    name: 'Dataleap',
    longDescription:
      'Dataleap is a GenAI-powered market research platform for management consulting firms and corporate strategy departments. Think Perplexity for Consultants. We combine the natural language interface from chatGPT with trusted, verifiable market data from best-in-class data providers. We do the heavy lifting of aggregating all data sources into a single interface. We optimize the whole market research workflow from finding the right information, managing the internal knowledge base as well as sharing information with team members.  We already work with leading consultancies like BCG and industry giants like Siemens Energy and Uniper. ',
    tags: 'Generative AI, Marketplace, Market Research, Enterprise Software, AI Assistant',
    industries: 'B2B',
    batch: 'S24',
  },
  {
    name: 'Zimi',
    longDescription:
      'Zimi is a cross-border commerce partner dedicated to simplifying global expansion for international brands. We empower businesses to thrive in new markets by optimizing cross-border logistics, offering seamless local fulfillment, and automating secure international payments—all in one streamlined platform.  Cross-border e-commerce is a $2 trillion opportunity by 2030, however, cross-border merchants face major challenges like high shipping costs, lengthy delivery times, and complex logistics. This is particular true for merchants in emerging markets. With Zimi, merchants reach their international buyers in 1-2 days instead of weeks and for a fraction of the price. Our aim is to make selling internationally as easy as selling locally - starting with merchants selling into the U.S. market. ',
    tags: 'B2B, Logistics, Supply Chain, Retail, Emerging Markets',
    industries: 'B2B, Supply Chain and Logistics',
    batch: 'S24',
  },
  {
    name: 'Thyme',
    longDescription:
      "There are 300k+ financial advisors in the US using a digital Rolodex to manage their client relationships, and it's time for a makeover. At Thyme we are building the OS for financial advisors that allows them to automatically take notes in meetings (in-person, online, and phone calls), manage their client records with the help of AI, and offer a client portal where clients can track their assets, manage tasks, and even pay for their services.  Our users have replaced their legacy CRMs and billing solutions with us while deepening their clients' relationships thanks to our client portal and AI tooling that puts rich context at their fingertips.",
    tags: 'Artificial Intelligence, Fintech, Finance',
    industries: 'B2B, Finance and Accounting',
    batch: 'S24',
  },
  {
    name: 'Ionworks',
    longDescription:
      'Every battery company spends tens of millions of dollars a year on experiments. Simulations that replace experiments reduce these costs but are currently underutilized in industry because they are hard to create and run. We make simulations accessible to every engineer, by helping them to create models from their own data, then run large scale simulations in the cloud to explore the full design space.',
    tags: '',
    industries: 'Industrials, Energy',
    batch: 'S24',
  },
  {
    name: 'Rescript',
    longDescription:
      "Rescript helps regulatory compliance and advocacy teams effortlessly track the constant stream of legal developments and always stay compliant. With our AI regulatory analyst, companies don't have to rely on expensive consultants or settle for inadequate tools that can't do the job.  How it works:  1. Comprehensive Tracking: Rescript scans the web for government meetings and regulatory documents, feeding them into our internal repository.  2. Intelligent Filtering: Our tool determines whether a new development involves the customer's regulatory priorities, using reasoning trained by 40+ regulatory analysts from top consulting firms. 3. Change Management: We sync with existing internal policies and materials, and evaluate them in light of new regulations.   For more information, visit www.rescript.ai or contact our team at team@rescript.ai.",
    tags: 'Artificial Intelligence, SaaS, Civic Tech, B2B, LegalTech',
    industries: 'B2B, Legal',
    batch: 'S24',
  },
  {
    name: 'Frontio - by NextUI',
    longDescription:
      'We began with an open-source library for React developers that enables them to create beautiful and accessible interfaces (NextUI). We are now building Frontio a complete frontend-as-a-service platform to make building the frontend part of products easier, allowing teams to focus more on their product and less on design systems and frontend complexities (frontio.ai).',
    tags: 'Developer Tools, SaaS, Design Tools, AI',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'S24',
  },
  {
    name: 'Helium',
    longDescription:
      'Helium is building self-improving software — AI that continuously experiments on key moments in the user funnel to boost revenue. Our first customer, a social app with 20M MAU, uses Helium to test new in-app paywalls to get more users to subscribe.  Zach previously made $100M+ in growth experiments at Uber, Shishir led the first LLM features for Alexa, and Anish worked at Meta building ML to automatically experiment on ads, increasing Instagram ads conversion by 10%. ',
    tags: 'Developer Tools, Machine Learning, B2B, Subscriptions',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'S24',
  },
  {
    name: '&AI',
    longDescription:
      '&AI is a secure workspace engineered for patent attorneys, leveraging AI to accelerate end-to-end prosecution and litigation workflows.',
    tags: 'SaaS, B2B, LegalTech',
    industries: 'B2B, Legal',
    batch: 'S24',
  },
  {
    name: 'Haystack Software',
    longDescription:
      'Haystack is a a canvas-based IDE that automates the tedious and mechanical steps of software development -- plumbing, refactoring, and finding code -- so that software engineers can focus on the important parts.  In Haystack, users can explore and edit their code on a 2D canvas with a navigational copilot assisting every step of their way.',
    tags: 'Developer Tools, B2B, Productivity, AI',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'S24',
  },
  {
    name: 'Finosu',
    longDescription:
      'Hi - Mark and Gab here! We met while working at Alt, a marketplace for collectibles, where we built a $200 million specialty finance business line. At Alt, we faced the complex challenges that come with servicing consumer loans. We spent countless hours and resources developing internal tools to manage loan payments, communicate with borrowers, and keep track of loan performance—all while ensuring a positive experience for our customers. However, after dealing with the headaches of manual data entry, fragmented systems, delayed payments, lack of personalized borrower engagement, and the stress of maintaining accurate records, we knew there had to be a better way to service consumer loans. So, we started Finosu to build the servicer we wish we had—an AI-powered consumer loan servicer designed to streamline and enhance every aspect of the loan servicing process. Our mission is to transform loan servicing into a seamless, efficient, and customer-centric experience. So, we started Finosu to build the tools that we wish we had. Finsou is building software to reduce the barriers to entry in lending, beginning with:  outsourced state licensing, default compliant loan management systems, and automated servicing infrastructure. The operational cost of originating and servicing loans reaches into the tens of billions a year and that is money out of the pocket of lenders, borrowers, investors, and ultimately the consumers as a cost of doing business – we are changing that.',
    tags: 'Fintech, B2B, Lending, Consumer Finance',
    industries: 'Fintech, Credit and Lending',
    batch: 'S24',
  },
  {
    name: 'Odo',
    longDescription:
      'State and local governments buy $1.5TN worth of products and services from companies every year. However, the process of finding and winning government contracts is extremely fragmented, non-standardized, and time consuming today. Odo is the first AI-powered platform to help companies win state and local government contracts. Odo can find relevant contracts, draft proposals, and analyze why companies won or lost through public records sourcing. Our customers have saved up to 80% of time drafting proposals and increased their win rates.',
    tags: 'Generative AI, GovTech, B2B, Productivity, Procurement',
    industries: 'Government',
    batch: 'S24',
  },
  {
    name: 'Baseline AI',
    longDescription:
      'The main document in a clinical trial is the study protocol. At large companies, floors of people use the protocol to create the study data collection forms, clinical database design, error checks, analysis code, and data transformation mappings. We use AI to automate the process of creating everything from the protocol, saving not only spend on headcount but also months of time which can translate to up to $27M in direct costs + lost revenue saved for a single phase 3 trial. ',
    tags: 'Artificial Intelligence, SaaS, Health Tech, B2B, Biotech',
    industries: 'Healthcare, Healthcare IT',
    batch: 'S24',
  },
  {
    name: 'RiskAngle',
    longDescription:
      'RiskAngle delivers fast, accurate summaries of complex medical records, speeding up insurance underwriting decisions, streamlining claims processing, and enabling lawyers to build stronger injury cases.',
    tags: 'Artificial Intelligence, SaaS, B2B, Insurance, Enterprise',
    industries: 'B2B',
    batch: 'S24',
  },
  {
    name: 'Winford Wealth',
    longDescription:
      'Winford Wealth empowers financial advisors to enhance client experiences with an AI Meeting Assistant. Our platform automates notetaking, seamlessly integrates with your CRM and tech stack, and delivers unique analytics to help you work smarter.  ',
    tags: 'Artificial Intelligence, Finance, Workflow Automation, Productivity, Enterprise Software',
    industries: 'B2B, Finance and Accounting',
    batch: 'S24',
  },
  {
    name: 'Cartage',
    longDescription:
      'Cartage is the future of freight coordination. Transparent, tech-driven and eliminating the need for human coordinators.',
    tags: 'Machine Learning, Workflow Automation, Logistics, Supply Chain, AI',
    industries: 'B2B, Supply Chain and Logistics',
    batch: 'S24',
  },
  {
    name: 'Paasa',
    longDescription:
      "Paasa is the global investing platform for aspiring HNIs in emerging markets. HNIs in countries like India want to diversify their wealth internationally. Saving their wealth in a depreciating currency puts them at risk in a global context. However, most customers still hesitate due to lack of guidance on capital controls, tax laws that change every year, and slow outflows from local banks. Paasa streamlines this - thus empowering HNIs to save for their child's education, spend overseas confidently, and build generational wealth in a stable currency. ",
    tags: 'Fintech, Consumer, Investing, Emerging Markets',
    industries: 'Fintech, Asset Management',
    batch: 'S24',
  },
  {
    name: 'Blast',
    longDescription:
      'Blast helps large enterprises build safe and reliable LLM apps. We provide a platform to help enterprises rigorously evaluate and turn their generative AI prototypes into reliable apps that can be confidently deployed at scale. ',
    tags: 'B2B, Enterprise Software, AI',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'S24',
  },
  {
    name: 'Lilac Labs',
    longDescription:
      "At Lilac, we automate the person taking order at the drive thru with a voice AI. We're building this for Quick Service Restaurants (QSRs) dealing with an historical labor shortage and rising wages. Previous attempts at drive-thru voice ordering are costly to implement and have failed to deliver the accuracy and latency needed. It's now possible to build a voice interface that passes the threshold for a great customer experience. In the United States, there are 200,000 Drive-Thrus handling 6 Billion visits a year. At 3 minutes per order, that's 34,000 human years spent on taking orders annually. Per location, on average we can deliver around $100,000 of value in terms of labor savings, upsell revenue lift, and training costs.",
    tags: '',
    industries: 'B2B',
    batch: 'S24',
  },
  {
    name: 'Palmier',
    longDescription:
      'Code repositories are built for humans to understand and collaborate on code. But soon, they’ll be used primarily by AIs working on our behalf. As this shift happens, the structure and processes around code must evolve. At Palmier, we’re building a new kind of code repository designed for AIs. Every line of code has a history behind it, and we’re making that history accessible for AIs to create more efficient and reliable code, aligned with human intention. Our first product is a platform that helps developers work seamlessly with AI, improving efficiency. We aim to provide an API for any AI to interact with code, giving it the information needed to produce better quality code. Reach out at founders@palmier.io',
    tags: 'Developer Tools, SaaS, B2B, AI',
    industries: 'B2B, Productivity',
    batch: 'S24',
  },
  {
    name: 'Simple AI',
    longDescription:
      'Simple AI places places AI calls to help you find things, call customer support, make reservations, and get things done.',
    tags: 'Artificial Intelligence, Consumer, AI, AI Assistant',
    industries: 'Consumer',
    batch: 'S24',
  },
  {
    name: 'Sensei',
    longDescription:
      'Sensei helps robotics companies scale and outsource their training data collection. Our hardware platform enables the collection of human-demonstration data at a tenth of the cost and twice the speed of current teleop approaches. Our software platform acts like Scale AI for robotics data: a large network of paid human operators use our low-cost collection platform to fulfill data-generation requests. ',
    tags: 'Artificial Intelligence, Hard Tech, Marketplace, Robotics, Data Engineering',
    industries: 'Industrials, Manufacturing and Robotics',
    batch: 'S24',
  },
  {
    name: 'Guardian RF',
    longDescription:
      "The rise of weaponized drones has fundamentally transformed security threats both in warfare and civilian contexts. In Ukraine, $500 modified commercial drones regularly neutralize million-dollar military assets. At our southern border, cartels use drones to smuggle fentanyl and survey law enforcement positions. Critical infrastructure, military bases, and correctional facilities face unprecedented vulnerability to unauthorized surveillance and drone-based attacks. Founded in 2024, GuardianRF develops advanced RF spectrum sensors to protect against this evolving threat landscape. Our technology has been battle-tested in Ukraine, where consumer drones converted into precise guided missiles have become a daily reality. Unlike traditional systems that rely on regulatory compliance, our sensors can detect modified and non-Remote ID compliant drones from up to 3 km away, accurately pinpointing both drone and operator locations. What sets us apart is our distributed mesh network of sensors combining advanced Software Defined Radio (SDR) technology with AI-driven signal classification. Trained on extensive combat zone datasets, our system processes RF signatures in real-time across multiple frequency bands, catching even sophisticated stealth drones using frequency-hopping protocols. When a threat is detected, the system delivers precise targeting data while maintaining continuous tracking. Our product line includes: - Scout Detector: A handheld drone detector for rapid deployment and portability - Mosaic Sensor Network: A scalable mesh network of RF sensors for detecting, tracking, and mapping drone activity across expansive areas The stakes are severe: along our borders, cartel drones facilitate trafficking that costs thousands of lives annually. In prisons, a single successful drone contraband delivery can trigger facility-wide violence. For critical infrastructure, a coordinated drone strike could cause billions in business interruption losses. Traditional drone defense systems, often priced in the millions, are cost-prohibitive for most organizations. GuardianRF bridges this critical gap with accessible, effective protection. Our AI classification engine recognizes various control protocols including modified ExpressLRS, Crossfire, and DJI variants, providing early warning of threats that traditional systems miss entirely. The system's fully automated detection, tracking, and response mechanisms ensure continuous protection with minimal operational overhead. Built and manufactured in the United States, GuardianRF combines field-proven technology with real-world deployment experience to counter modern drone threats. Whether safeguarding critical infrastructure, securing borders, or supporting defense operations, our systems deliver the comprehensive drone detection capabilities needed for today's security challenges.",
    tags: 'Hard Tech, Drones, Security',
    industries: 'Industrials, Drones',
    batch: 'S24',
  },
  {
    name: 'Laminar',
    longDescription:
      'Laminar is an open-source platform which provides observability, text analytics, evals and prompt chain management for AI agent.  ',
    tags: 'AIOps, Artificial Intelligence, Developer Tools, SaaS, B2B',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'S24',
  },
  {
    name: 'Cerulion',
    longDescription:
      'Cerulion is an open source operating system for robots built by 2 MIT robotics PhDs. Companies like Amazon Robotics and Boston Dynamics AI Institute are using us to develop faster and ship more reliable robots than with ROS. With up to 1000x improvements in communications performance over state of the art, Cerulion is enabling the next generation of embodied AI.',
    tags: 'Developer Tools, Hard Tech, Robotics, B2B, Open Source',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'S24',
  },
  {
    name: 'Presti AI',
    longDescription:
      'Furniture companies spend millions and months each year on photoshoots or CGI to create product images as these visuals are crucial for driving sales. Presti offers a faster and cheaper solution powered by generative AI. Unlike other generative AI tools, our core model is optimized for furniture products and includes multiple features tailored to the unique needs of furniture industry.   We have 100 paying B2B users with a 10% growth week over week. We raised a $3.5M seed round',
    tags: 'Artificial Intelligence, B2B, E-commerce, AI',
    industries: 'B2B, Retail',
    batch: 'S24',
  },
  {
    name: 'The Forecasting Company',
    longDescription:
      'The Forecasting Company builds planning systems based on our in-house foundation models for time series. ',
    tags: 'Artificial Intelligence, B2B, Supply Chain, Enterprise Software, AI',
    industries: 'B2B',
    batch: 'S24',
  },
  {
    name: 'Praxos',
    longDescription:
      'Praxos allows insurance professionals to automate their operations—from filling out applications to crafting proposals and comparing coverages—in one place. This enables risk advisors to stand out and close more deals in an industry where service speed is critical, but mistakes are costly.',
    tags: 'Artificial Intelligence, Generative AI, B2B, Compliance, Insurance',
    industries: 'B2B',
    batch: 'S24',
  },
  {
    name: 'Exa Laboratories',
    longDescription:
      "Exa is making reconfigurable chips for AI, offering superior speed and energy efficiency compared to traditional GPUs/TPUs/LPUs. Our chips automatically adapt themselves to each specific AI model, overcoming the von Neumann bottleneck, (a common limitation in standard systems). By optimizing for each AI architecture, we significantly boost both inference and training speeds while reducing energy consumption. Imagine having hardware tailored to your AI model, whilst still maintaining the flexibility of a GPU. This way, you won't need to re-manufacture your hardware each time you change your model architecture, all while still benefiting from the speed and efficiency of specialized hardware, saving data centers and compute clusters hundreds of millions of dollars every year!",
    tags: 'Hard Tech, Hardware, Machine Learning, Semiconductors, AI',
    industries: 'Industrials',
    batch: 'S24',
  },
  {
    name: 'SchemeFlow',
    longDescription:
      'SchemeFlow uses AI to automate government approvals for construction projects. Two brothers + high school friend, with great combo of skills: Mayor’s Chief of Staff, Arup construction engineer + AI software engineer. Using LLMs to generate reports in minutes rather than months, and to scrape + parse complex local regulations. Already generated over 10,000 pages of technical reports for over 400 construction projects, from car parks to hotels, housing to office buildings, with 97% time savings. Started in the UK with 10x paid pilots with engineering companies such as Stantec and Royal Haskoning, now pivoted to focus on the US. $9B US opportunity (143k consultants x $64k/yr report-writing work), $23B worldwide. www.schemeflow.com',
    tags: 'Documents, Generative AI, GovTech, Construction, Proptech',
    industries: 'Real Estate and Construction',
    batch: 'S24',
  },
  {
    name: 'Brighterway',
    longDescription:
      "At Brighterway, we use AI to speed up the medical record review process for physicians in medlegal exams. Physicians spend hours reviewing thousands of pages of medical documents– our technology highlights the information that is most relevant to a doctor's specialty, streamlining their review process and saving them time. Brighterway structures and deduplicates disorganized medical records (PDFs) and extracts the content that is medically relevant and related to a doctor's specialty, so they can focus on what matters most.",
    tags: 'Artificial Intelligence, Health Tech, Healthcare, LegalTech, AI',
    industries: 'Healthcare, Healthcare IT',
    batch: 'S24',
  },
  {
    name: 'Mineflow',
    longDescription:
      "Mineflow is an AI platform for mineral exploration. We generate predictions for mineral deposit shapes and locations, empowering mining companies from initial exploration to advanced feasibility studies. Geologists need to know precisely where their deposits are because drilling is expensive. In early trials with a lithium mining company, we found that Mineflow predicts the shape of hard rock lithium deposits more than an order of magnitude more accurately than our competitors. Ryan received a BS in Artificial Intelligence from Carnegie Mellon's School of Computer Science where he helped teach both the grad-level Deep Learning course and the grad-level Search Engines course. He built ML models at Google in the Display Ads optimization org for 2 years and launched products that generated ~125m USD in ARR.",
    tags: '',
    industries: 'Industrials',
    batch: 'S24',
  },
  {
    name: 'Soff',
    longDescription:
      'Soff is a supply chain OS for manufacturing companies. We unify supply chain data and automate core workflows, such as data entry, requesting quotes, comparing quotes, and issuing purchase orders. Our customers save dozens of hours a week spent on repetitive manual tasks.',
    tags: 'B2B, Manufacturing, Supply Chain, Procurement, Enterprise Software',
    industries: 'B2B, Supply Chain and Logistics',
    batch: 'S24',
  },
  {
    name: 'Parley',
    longDescription:
      "Parley automates flat-fee legal work using LLM’s, starting with visa applications for immigration lawyers. Currently, immigration lawyers spend 20+ hours putting together writing-intensive work visas and green cards. We integrate directly into a lawyer's workflow and do all the reading, writing, and compiling — which is 80% of the work required to file a visa application. ",
    tags: 'Artificial Intelligence, SaaS, Legal, LegalTech, Immigration',
    industries: 'B2B, Legal',
    batch: 'S24',
  },
  {
    name: 'Intryc',
    longDescription:
      "Consumer enterprises have millions of customer support tickets annually. They need to constantly evaluate support agents’ performance and compliance. Typically they evaluate less than 5% of those interactions manually which is slow, expensive and not scalable. Intryc's AI can evaluate 100% of all customer interactions, in real time, at half the cost. ",
    tags: 'Customer Success, Analytics, Customer Support, Operations',
    industries: 'B2B, Operations',
    batch: 'S24',
  },
  {
    name: 'Pinnacle',
    longDescription:
      "Pinnacle is an API for RCS, the new standard for SMS for app-like text messages. For example, developers can create messages that show products that can be purchased with one tap natively on iOS and Android. If you're currently using SMS from Twilio, etc, and you don't want to leave money on the table, get in touch with us - founders@trypinnacle.app with subject \"YCBIO\".  If you're a YC company, we'll get you a free founders mode™️ hat, 1000 free msgs/mo + 24/7 real founder mode™️ support when you switch to us.",
    tags: 'Developer Tools, B2B, Sales, E-commerce, SMS',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'S24',
  },
  {
    name: 'Ember Robotics',
    longDescription:
      "Ember Robotics is building the hardware observability layer for autonomous robots, starting with camera diagnostic tools. We worked on optimizing camera performance at Tesla Autopilot and now we're building software that takes mitigating camera failures from hours to minutes.",
    tags: 'Developer Tools, Robotics, B2B, Analytics, Data Visualization',
    industries: 'Industrials, Manufacturing and Robotics',
    batch: 'S24',
  },
  {
    name: 'Thunder Compute',
    longDescription:
      'GPUs are in extremely high demand for AI development. A single GPU server can cost up to $300K. Despite this, GPUs in data centers are only utilized an average of 15-20% of the time. Thunder Compute is building technology to increase GPU utilization from 15-20% to 90%+, meaning that each GPU can be shared by 5x as many developers as in data centers today. Our technology achieves this efficiency gain by allowing all of the servers in a data center to share a single pool of network-attached GPUs rather than physically attaching a GPU to each server. Try Thunder Compute at docs.thundercompute.com/quickstart',
    tags: 'Artificial Intelligence, Developer Tools, Data Science, Cloud Computing, Infrastructure',
    industries: 'B2B, Infrastructure',
    batch: 'S24',
  },
  {
    name: 'Kura AI',
    longDescription:
      "Kura breaks 87% on the WebVoyager Benchmark. That is 31% better than Claude's Computer Use demo and 14% better than the previous State of the Art. In 10 years there will be more AI agents on the internet than humans. Kura is SOTA for giving AI agents the tools for interacting with websites.",
    tags: 'Artificial Intelligence, Generative AI, AI',
    industries: 'B2B',
    batch: 'S24',
  },
  {
    name: 'Zeit AI',
    longDescription:
      'Zeit AI transforms Excel files in a structured database that can be queried using natural language. For example, the financial consultancy RISE, which depends heavily on Excel, uses Zeit AI to access and analyze expenses across their organization.',
    tags: '',
    industries: 'B2B, Analytics',
    batch: 'S24',
  },
  {
    name: 'Remade',
    longDescription:
      'Remade uses AI to scale hyper-personalized video generation for marketplaces. Our first customer, Scentbird, a midmarket fragrance marketplace uses Remade to create engaging TikTok ad hooks. We are a team of 4 Cambridge AI hackers with publications in CVPR, the largest Computer Vision conference, and the Lancet Journal, the most respected medical journal globally. Our ARR grew 83% last week from 18k to 33k with an additional 17k pilot revenue with Rappi and eFood, which will take us to a 650k contracted ARR by EoQ. We are building out a research-arm to develop proprietary tech, fusing recommendation algorithms with video models to deliver hyper-personalised videos that increase conversion.',
    tags: 'Artificial Intelligence, SaaS, B2B, Social Media, Marketing',
    industries: 'B2B, Marketing',
    batch: 'S24',
  },
  {
    name: 'Distro',
    longDescription:
      'Distro is the all-in-one AI-powered sales platform for counter staff and inside sales at industrial wholesale distributors (HVAC/R, plumbing, electrical, and more).',
    tags: 'Artificial Intelligence, SaaS, B2B, Manufacturing, Supply Chain',
    industries: 'B2B, Supply Chain and Logistics',
    batch: 'S24',
  },
  {
    name: 'Modern Realty',
    longDescription: 'Tech enabled B2C Realtor representation for home buying',
    tags: 'Artificial Intelligence, Real Estate, Consumer, Consumer Products, AI',
    industries: 'Real Estate and Construction, Housing and Real Estate',
    batch: 'S24',
  },
  {
    name: 'David AI',
    longDescription: '',
    tags: '',
    industries: 'B2B',
    batch: 'S24',
  },
  {
    name: 'BeeBettor',
    longDescription:
      'BeeBettor makes sports betting simple. Currently, sports bettors download more than 40 sports betting apps to get the full experience. At each one, they must go through a long KYC process. Then once their 40 accounts are active and funded, finding the best price is a painstaking process involving third-party tools to search available offers. BeeBettor aggregates all these accounts into one app and automatically gives sports bettors the best price.',
    tags: '',
    industries: 'Consumer, Gaming',
    batch: 'S24',
  },
  {
    name: 'Guardian AI',
    longDescription:
      'Guardian is an AI platform to help healthcare providers (hospitals, MSOs, physician groups) fight denials and address unpaid claims. Providers deploy Guardian to: 1. Detect emerging patterns in payer reimbursements 2. Automate the diagnosis and resolution of unpaid claims and denials',
    tags: 'Artificial Intelligence, Health Tech, Workflow Automation',
    industries: 'Healthcare',
    batch: 'S24',
  },
  {
    name: 'Stempad',
    longDescription:
      "You can think of Stempad as a Notion for science. It is the world's first true pen-and-paper alternative to fast scientific writing and collaborating. Quickly switch between different forms of technical visualization with the ease of a whiteboard and the convenience of your keyboard. Stempad allows you to share your work, collaborate in real time, store your data, annotate, write papers, plan, takes notes, create presentations, and so much more. Our vision is to make it easier and faster for students and scientists to digitize and share their scientific ideas.",
    tags: '',
    industries: 'B2B, Productivity',
    batch: 'S24',
  },
  {
    name: 'Pax',
    longDescription:
      'Pax uses AI to automate import tax refunds (aka duty drawback) for retailers and manufacturers. We launched 4 weeks ago and have ~$200K in contracts. Each year, 80% of eligible refunds—equivalent to $15B—go unclaimed. Pax is the first AI-powered broker helping brands under $50M reclaim 3-5% of their revenue. Our algorithms generate 15% more refunds than the industry leader and reduce processing time by 99% with AI. We are two technical founders: Penny got her PhD from MIT and, and was a former research scientist at Amazon & Flexport, where I encountered the problem firsthand. Chris is a second-time founder and former software engineer at Amazon, Brex, and TikTok.',
    tags: '',
    industries: 'B2B, Supply Chain and Logistics',
    batch: 'S24',
  },
  {
    name: 'Conductor Quantum',
    longDescription:
      'Quantum computers will allow humanity to understand the world at its most fundamental level, enabling the acceleration of drug discovery and the development of new materials.  Currently, quantum engineers spend days, sometimes weeks, manually getting their silicon chips to operational conditions to realize two qubits. A qubit is the information-carrying unit of a quantum computer, analogous to a bit in a classical computer.  We need billions of qubits to make a useful quantum computer. Therefore, automation software will be vital to realizing this goal.  Conductor Quantum will develop AI software to remove the human from the loop, enable the scaling of silicon quantum technology and build a silicon-based quantum computer.',
    tags: 'Hard Tech, Machine Learning, Quantum Computing, Semiconductors, AI',
    industries: 'Industrials',
    batch: 'S24',
  },
  {
    name: 'Autumn Labs',
    longDescription:
      'Autumn Labs delivers a developer-friendly platform for monitoring and managing modern manufacturing lines. Seamlessly integrating with robotic stations—automated test stations, robotic assembly cells, and industrial arms—it ensures full traceability, live data monitoring, and secure data transport. We prioritize streamlining factory operations, boosting production quality, and preventing supply chain disruptions, all while offering an effortless onboarding experience for engineers and manufacturers.',
    tags: 'Hardware, Robotic Process Automation, SaaS, Robotics, Manufacturing',
    industries: 'Industrials, Manufacturing and Robotics',
    batch: 'S24',
  },
  {
    name: 'Opslane',
    longDescription:
      "Opslane speeds up incident resolution by automating work that is performed by short staffed SRE teams.  We do this by stitching together relevant context (logs, metrics, traces, code changes and runbooks) to help on-call engineers figure out what's going on.",
    tags: 'Artificial Intelligence, Developer Tools, Open Source, Enterprise, DevOps',
    industries: 'B2B, Infrastructure',
    batch: 'S24',
  },
  {
    name: 'Asterisk',
    longDescription:
      'Asterisk (asterisk.so) is an AI Hacker for Codebases - it automatically finds, verifies, and patches security vulnerabilities in codebases, just like a human security engineer would. Asterisk can find business logic errors with context-aware scanning and automate the full auditing cycle to generate reports with near-zero false positives.  Asterisk has autonomously discovered vulnerabilities in Google, Hoppscotch, and others.',
    tags: 'Artificial Intelligence, SaaS, B2B, Security, AI',
    industries: 'B2B, Security',
    batch: 'S24',
  },
  {
    name: 'Biocartesian',
    longDescription:
      'Finding new cures requires seeing what and where the abnormal molecules are in a diseased tissue, but current tools see less than 1% of those molecules. Biocartesian combines microscopy and new chemistries to see 50X more, offering unprecedented insights into disease biology and new therapies.',
    tags: 'Hard Tech, B2B, Biotech, Diagnostics, Drug discovery',
    industries: 'Healthcare, Drug Discovery and Delivery',
    batch: 'S24',
  },
  {
    name: 'Seals AI',
    longDescription:
      'Seals is a suite of AI Employees for Wholesalers & Distributors. Instead of relying on humans to quote, take orders, collect payments, place purchase orders and enter data into ERPs. We build AI Employees that do these manual repetitive tasks for the 700k wholesalers in the US. We’re a team of three Computer Science majors, and Fernando launched and grew AT&T in Mexico to $120M ARR. Previously, we all worked together at our last YC-backed startup, building it to over $6M in revenue. It was there that we placed thousands of purchase orders with wholesalers. We realized that almost every physical product comes from B2B sales in the supply chain. However, it turns out that most of these operations are still done manually through phone and email, involving tasks like quoting, taking orders, collecting payments, entering data into ERPs, and providing support. By automating these tasks with AI agents in a human-like manner, we are creating a massive opportunity to convert $100B of payroll expenses into software spending. ',
    tags: 'Artificial Intelligence, SaaS, B2B',
    industries: 'B2B',
    batch: 'S24',
  },
  {
    name: 'deepsilicon',
    longDescription: '',
    tags: 'Edge Computing Semiconductors, Hard Tech, AI',
    industries: 'Industrials',
    batch: 'S24',
  },
  {
    name: 'Drillbit',
    longDescription:
      'Residential contractors are drowning in office work. Drillbit automates all of it. We use AI receptionists and an LLM based quoting tool on top of our own CRM to entirely manage jobs from lead, to quote, to scheduling, to staffing, and even collecting payment.',
    tags: '',
    industries: 'B2B, Operations',
    batch: 'S24',
  },
  {
    name: 'Lumenary',
    longDescription:
      "Lumenary is a code-generation platform and IDE that makes designing rigorous, data-intensive applications feel like whiteboarding. We provide a canvas-based UI that helps users and LLMs work off the same code and infrastructure context, while programmatically generating full-stack apps from high-level specifications. Lumenary was founded by four best friends who met at Dartmouth College, with engineering expertise from Jane Street Capital, IMC Trading, and Palantir Technologies. They've published high impact machine learning research in venues like NeurIPS, in addition to deploying secure enterprise software managing billions of dollars and petabytes of data.",
    tags: 'Developer Tools, Automation, AI',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'S24',
  },
  {
    name: 'Dimely',
    longDescription:
      "Dimely builds AI agents for B2B SaaS finance teams. Our agents automate and bring visibility to time-consuming and error-prone finance workflows so teams can stay lean and audit-ready. We do this by completing, logging, and reconciling the data work, including converting contracts to invoices, calculating overages, reconciling payments, and streamlining revenue recognition. We pride ourselves in our fast time to value. Dimely seamlessly slots into your existing workflows without requiring a rip and replace, meaning you'll immediately see results from Day 1. Stop spending hours on billing today! ",
    tags: 'Artificial Intelligence, FinOps, B2B, Automation, Billing',
    industries: 'B2B, Finance and Accounting',
    batch: 'S24',
  },
  {
    name: 'Redouble AI',
    longDescription:
      'Redouble AI is the solution to scale human-in-the-loop for AI workflows in regulated industries. Instead of having to rely on slow and expensive human reviewers, Redouble’s clients save 80% of staff costs and significantly improve the accuracy and quality of their outputs by integrating our tool into their workflows. Addressing an $11BN market, the company is already generating revenue with its first set of clients. The founders are two serial entrepreneurs (who have built successful companies in AI and health-tech respectively) and a data engineering veteran who has written more than 120 enterprise-grade software applications.',
    tags: 'Generative AI, B2B, Enterprise Software, AI',
    industries: 'B2B',
    batch: 'S24',
  },
  {
    name: 'Planbase',
    longDescription:
      'Planbase has everything health clinics need to manage their team in one place: capacity planning, employee scheduling, credentialing and payroll. ',
    tags: 'Artificial Intelligence, SaaS, Health Tech, B2B',
    industries: 'Healthcare, Healthcare IT',
    batch: 'S24',
  },
  {
    name: 'Unriddle',
    longDescription:
      "Unriddle is a web app that helps industry and academic researchers read, write and find research papers really quickly. In just one year we've grown to 1.6M users including teams at Stanford University, GSK and Johns Hopkins. We're using language models to help researchers quickly and deeply understand papers, write literature reviews, prepare citations and keep the whole research team on the same page. Analyzing the key themes and gaps in a field usually means going through hundreds of papers, which is both time-consuming and disorganized. Researchers also might struggle to understand a paper's importance when working across different disciplines without the necessary context. Unriddle understands the context behind your research. It synthesizes relevant findings, highlights connections between papers and suggests related studies you might have missed. We’re starting with software to read, write and find papers, but our ultimate goal is to build the researcher of the future: a human-AI hybrid that’s an order of magnitude more effective than any individual researcher.",
    tags: 'Artificial Intelligence, Consumer, B2B',
    industries: 'B2B',
    batch: 'S24',
  },
  {
    name: 'Hestus, Inc.',
    longDescription:
      'Hestus is AI-powered CAD software that speeds up hardware development. While engineers are typically quick at coming up with initial design concepts, they are bogged down getting from idea to the final design due to countless tedious and repetitive tasks. We are building CAD software that automates these mundane tasks and speeds up the design execution process, while letting engineers spend more time on the creative part of the design process. ',
    tags: '',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'S24',
  },
  {
    name: 'MagiCode',
    longDescription:
      'MagiCode is an AI-powered frontend agent that writes, reviews, and rigorously tests code before pushing a PR—helping busy frontend teams offload complex, repetitive tasks from their workload.',
    tags: 'Developer Tools, Generative AI, SaaS, B2B, Enterprise Software',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'S24',
  },
  {
    name: 'FINNY AI',
    longDescription:
      'FINNY is building a new operating system for independent financial advisors, and starting by helping them grow.   Our goal is to empower the best financial advisors (the independents!) to serve all Americans who want financial advice.  We are starting with growth, which is the most existential problem advisors face.                                                                                                                                                         The organic growth process is highly inefficient and full of noise. Advisors often waste 60 hours of business development to convert 1 new client.   At FINNY, we are certain we can do better with AI. With our tool, advisors can: - Identify prospects within their target niche, aggregating thousands of data points per lead - Prioritize prospects based on their predicted likelihood of converting, a score unique to each advisor and prospect pair - Automate the outreach and meeting scheduling with their high priority prospects In essence, doing all the work for the advisors, and letting them focus on what actually matters, the client relationship.',
    tags: 'Fintech, Machine Learning, Finance, Sales Enablement, Automation',
    industries: 'Fintech, Asset Management',
    batch: 'S24',
  },
  {
    name: 'Focal',
    longDescription:
      'Focal enables f to effectively leverage AI to automate traditionally manual workflows. Our initial focus is geared towards helping financial institutions automate compliance, risk, and dispute operations.',
    tags: 'Artificial Intelligence, Fintech, SaaS, B2B, Operations',
    industries: 'B2B, Operations',
    batch: 'S24',
  },
  {
    name: '1849 bio',
    longDescription:
      '1849 bio designs microbes enabling cheap metal extraction allowing miners to unlock value from low quality copper and gold ores. Surprisingly, the mining industry is one of the largest scale users of biotech in the world with biomining processes accounting for ~1% of global copper production. Biomining is ultra-low cost, running around ~$1/ton of ore vs ~$7/ton for conventional processes.  Unfortunately, while biomining is cheap, it can’t be applied to over 80% of copper ores, leaving vast resources without profitable extraction methods. An estimated ~$800B of copper sit today in waste materials and stockpiles with negative unit economics. While a great deal of effort has been spent on optimizing microbial metal extraction processes, very little effort has been spent on optimizing the microbes themselves.  To change that, we’re creating new biotech tools and platforms applied directly to the types of biology most relevant to miners. This enables us to develop new microbes and tackle some of the most difficult problems in biomining, unlocking billions in value from unprofitable resources while being more environmentally friendly than conventional processes. We’re world class microbial engineers. We met while doing our PhDs in synthetic biology, where we spent our time applying and developing the most advanced bioengineering technologies to engineer living cells. ',
    tags: 'Hard Tech, Synthetic Biology, Biotech, Climate, Mining',
    industries: 'Industrials',
    batch: 'S24',
  },
  {
    name: 'ReactWise',
    longDescription:
      'Our Mission:  We aim to accelerate and automate chemical process development by equipping wet-lab chemists with the power of data-driven optimization and robotic execution of experiments. The Problem:  The discovery of novel pharmaceuticals is one of our most important weapons in fighting disease. However, the drug development pipeline is often held up for many months during the design of chemical processes to manufacture these drugs at scale, delaying FDA trials and lengthening the time until drug launch. Designing chemical processes involves the identification of suitable parameters such as catalyst/temperature/solvent. Currently process development is often done via tedious trial-and-error experimentation (slow) or exhaustive screening (expensive and wasteful). Our Approach:  In our research, we have developed algorithms for chemical process optimization, which leverage transfer learning and Bayesian optimization. We validated the algorithms in the wet lab, showing an up to 95% reduction in required experiments and cost compared to exhaustive screening. We have made our approaches accessible to chemists through our user-friendly no-code software platform and to automated laboratory equipment with our API.',
    tags: '',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'S24',
  },
  {
    name: 'Olive Legal',
    longDescription:
      "Olive uses AI to summarize client medical records for personal injury lawyers. We're at $13k MRR after launching eight weeks ago, and law firms choose us because we double paralegal efficiency. As we take over more legal workflow, Olive will serve victims of medical malpractice directly.  Sam's ex-girlfriend introduced him to Greg back at CMU in 2017, and while that relationship didn't last, their friendship has. After undergrad, Greg went to Harvard Law School, while Sam worked for three years at Jane Street, building & leading a satellite dev team. Greg graduated, Sam quit, and we founded Olive with a big idea: use AI to make the law more accessible. We started with AI in corporate law given Greg's background, but quickly realized the space was crowded, and turned our attention to the under-competed $65B personal injury market. AI disruption makes a lot of sense in personal injury because the incentives are aligned—plaintiff lawyers are paid on contingency, and therefore love time-saving tools. We have competitors who have proven substantial demand for medical summaries, but they operate at best on hybrid human/AI approaches with multi-day turnarounds. We think there's space for an AI solution that cuts humans out of the loop entirely, and we think we're the right team to do it. We're focusing on the medical malpractice niche within personal injury, because there's a massive access to justice problem: medical malpractice lawyers decline most cases under $500k since they're too expensive to litigate. An estimated 80% of medical malpractice victims can't secure representation right now. We estimate this latent demand at $48bn/year. We are on a mission to unlock this value.",
    tags: '',
    industries: 'B2B, Legal',
    batch: 'S24',
  },
  {
    name: 'Saturn',
    longDescription:
      'At Saturn, our mission is to make financial peace of mind more accessible by building the best operating system for wealth managers.  Wealth and Asset Management is one of the world’s highest revenue-generating industries, yet it remains painfully inefficient. The sector relies heavily on disjointed legacy systems, manual human tasks, and a complex web of intermediaries, all of which increase costs.  Saturn is an AI-powered operating system for wealth management built to automate investment research, streamline operations, and ensure compliance. Saturn creates the best version of truth, empowering investment advisors to work more efficiently, navigate complex regulatory landscapes, and deliver personalised, high-value services to their clients. Today, Saturn supports over 200 firms globally that manage more than £35bn in assets under management (AUM) and over 200,000 clients. As the industry grows, it faces massive operational challenges like bad tech, advisor retirements, regulatory pressure, an increased cost base, and transformational opportunities like great intergenerational wealth transfer and changing consumer needs. Saturn aims to be at the forefront of this transformation, driving the future of wealth management.',
    tags: 'Fintech, Generative AI, B2B',
    industries: 'Fintech',
    batch: 'S24',
  },
  {
    name: 'Clearly AI',
    longDescription:
      "Clearly AI automates security and privacy reviews with AI. We performed hundreds of reviews at Amazon and Moveworks and now we're building the product we wish we had. We launched in August 2024 and secured two paid pilots within a week, including a major electric automaker. Our users complete reviews in minutes instead of days. Emily and Joe are technical co-founders and senior engineers. We met in 2019 while working on an Alexa security review.",
    tags: 'Artificial Intelligence, Security, Privacy',
    industries: 'B2B, Security',
    batch: 'S24',
  },
  {
    name: 'expand.ai',
    longDescription:
      'expand.ai instantly turns any website into a type-safe API you can rely on. You can either request data from any website instantly or let expand.ai build up datasets for you. We take care of the hard parts like dealing with bot protection, scaling browser infrastructure and making sure that we only extract verified, correct information.',
    tags: 'Developer Tools, Infrastructure',
    industries: 'B2B',
    batch: 'S24',
  },
  {
    name: 'Promi',
    longDescription:
      "Promi is an AI-powered price and discount optimization platform. We help eCommerce merchants personalize their sales to generate additional revenue and profit. Ecommerce merchants and marketers typically use discounts to drive customer acquisition, boost sales during holidays, or liquidate inventory. But deciding on a discount to offer is typically guesswork. Who to send the discount to, how much to offer, and which products it applies to are, in the most advanced cases, determined manually by looking at past sales and seeing what worked well. In the majority of cases, it's what feels and sounds good. Promi leverages store data to optimize discounts at a more granular level than possible manually. We dynamically determine the best value across each product, for different users, at different times in order to maximize sales and profit.",
    tags: '',
    industries: 'B2B, Retail',
    batch: 'S24',
  },
  {
    name: 'Ontra Mobility',
    longDescription:
      'Ontra Mobility is founded by two former Googler engineers with PhDs in operations research. Ontra helps cities and other transit agencies increase ridership through data-driven planning and real-time optimization. The founders developed the software that powered MARTA Reach in Atlanta, GA and CAT SMART in Savannah, GA.',
    tags: 'Artificial Intelligence, Civic Tech, GovTech, Climate, Transportation',
    industries: 'Government',
    batch: 'S24',
  },
  {
    name: 'Fortress',
    longDescription:
      'Fortress is a Postgres developer platform that makes it simple to globally distribute data (replication and sharding) in a cost-effective manner.   Developers use Fortress to reduce network latency for their global users, comply with data sovereignty regulations, and for the peace of mind of a platform that manages horizontal scalability. ',
    tags: 'Developer Tools, B2B, Security, Databases',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'S24',
  },
  {
    name: 'Panora',
    longDescription:
      'Panora helps warehouses drive more business by connecting to any e-commerce platform and provides an AI assistant that automates data entry into WMS & ERPs platforms.',
    tags: 'Warehouse Management Tech, Logistics, API, Infrastructure, AI',
    industries: 'B2B',
    batch: 'S24',
  },
  {
    name: 'Manaflow',
    longDescription:
      'Manaflow enables businesses to build and automate internal tool workflows involving data, APIs, and actions with AI agents using natural language.  Manaflow replaces the boring, manual internal tools of the past with a new paradigm of internal tools built for and operated by AI agents instead of human operations teams. Let AI agents tackle repetitive research tasks, data consolidation, analytical reports, and database actions while you focus on the bigger picture for your company. Stop wasting engineering resources on boring internal tools that require even more human resources to operate them.',
    tags: 'Artificial Intelligence, Developer Tools, B2B, Operations',
    industries: 'B2B',
    batch: 'S24',
  },
  {
    name: 'Conveo',
    longDescription:
      'Conveo is an AI-powered platform for conducting and analyzing qualitative research through in-depth video and voice interviews. We help marketing, insights, product, and design teams gather customer insights 100x faster and at a fraction of the cost.',
    tags: 'SaaS, Feedback, Market Research, Enterprise Software, Conversational AI',
    industries: 'B2B',
    batch: 'S24',
  },
  {
    name: 'Parity',
    longDescription:
      "Parity is the AI SRE for Incident Response. We're the first line of defense for on-call engineers working with Kubernetes - Parity autonomously triages, root causes, and heals your cloud infrastructure.",
    tags: 'Artificial Intelligence, Developer Tools, B2B, Kubernetes, DevOps',
    industries: 'B2B',
    batch: 'S24',
  },
  {
    name: 'Kastle',
    longDescription:
      "Kastle is an AI voice agent for mortgage servicing. We help servicers collect payments, verify new borrowers, and qualify new loan inquiries over the phone.  Rishi and Nitish met at UIUC where they graduated with degrees in systems engineering and computer science.  Rishi was the founding Product Manager for Redfin’s Mortgage Marketplace at 22 and grew the business from $3M to $6M in revenue in 9 months. Nitish patented Verkada’s motion search system and was the youngest tech lead at the company at 23. While building Redfin's Mortgage Marketplace Rishi realized traditional lenders didn't have the infrastructure to service online inquiries and were losing customers. Nitish and Rishi are building Kastle to help traditional financial services companies better interface with their customers. ",
    tags: '',
    industries: 'B2B',
    batch: 'S24',
  },
  {
    name: 'Kopra Bio',
    longDescription:
      'Kopra Bio makes genetically engineered viruses that teach your immune system to kill cancer using tech we developed at UCSF. We’re making the next Keytruda ($25B/yr cancer drug blockbuster) starting with the most aggressive form of brain cancer, glioblastoma. In the most challenging brain cancer model, we improve survival from 0% with the current FDA approved treatment to 90% with our treatment.',
    tags: 'Gene Therapy, Synthetic Biology, Biotech, Therapeutics, Oncology',
    industries: 'Healthcare, Therapeutics',
    batch: 'S24',
  },
  {
    name: 'Anthrogen',
    longDescription:
      'Anthrogen uses genetically modified bacteria and optimized enzymes to turn carbon from the air into cheap chemicals. Think Solugen but for more complex molecules/enzyme cascades and using atmospheric carbon instead of sugar as a base.  We have engineered the fastest photosynthesizing organism in the world with CRISPR and use generative models to design our enzymatic cascades. We are stating with jet/rocket fuel but will expand to other verticals soon.',
    tags: '',
    industries: 'Industrials, Climate',
    batch: 'S24',
  },
  {
    name: 'Benchify',
    longDescription:
      'Benchify is a code review tool that uncovers real bugs by rigorously testing code using methods typically restricted to rocket science and chip design.',
    tags: 'Developer Tools, Generative AI, Enterprise Software',
    industries: 'B2B',
    batch: 'S24',
  },
  {
    name: 'Fazeshift',
    longDescription:
      'Fazeshift is an AI agent for automating Accounts Receivable. What used to take teams of people and hours of manual work can now be fully automated with Fazeshift.  Caitlin and Timmy met while getting their MBA at Harvard. After graduating, they started a B2B marketing software startup, which is where they first experienced the pain of this process. The problem stems from fragmented data across software platforms like QuickBooks, Stripe, NetSuite, DocuSign, HubSpot, and Salesforce. Fazeshift’s infrastructure connects the data across these software platforms and uses LLMs to automate the previously manual workflow.',
    tags: 'Fintech, B2B, AI',
    industries: 'B2B, Finance and Accounting',
    batch: 'S24',
  },
  {
    name: 'TaxGPT',
    longDescription:
      "TaxGPT AI co-pilot for accountants and tax professionals increases tax firm's productivity and profitability by 10x by automating tax research, client communication, onboarding flows and secure document collection.",
    tags: 'Artificial Intelligence, Fintech, B2B',
    industries: 'B2B, Finance and Accounting',
    batch: 'S24',
  },
  {
    name: 'Substrate',
    longDescription:
      "Substrate's AI agents automate the click-work & data entry in revenue cycle management. Our agents perform repetitive and time-consuming tasks on behalf of medical billers, significantly increasing efficiency and reducing errors.",
    tags: '',
    industries: 'B2B',
    batch: 'S24',
  },
  {
    name: 'Zenbase AI',
    longDescription:
      "Zenbase helps developers focus on programming by automating prompt engineering and model selection. We’re core contributors of Stanford NLP’s DSPy, the #1 LLM optimization framework used by Meta, Microsoft, Google, among many others. But it's hard to use outside of academia. We're building the production version.",
    tags: 'Generative AI, SaaS, Open Source, Infrastructure, AI',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'S24',
  },
  {
    name: 'Taxo',
    longDescription:
      'Taxo integrates with electronic health records (EHRs) to automate medical billing and coding. Its AI-powered solution reduces the time and cost of claims processing by >90%, enabling providers to focus on patient care rather than administrative tasks.',
    tags: 'Artificial Intelligence, Healthcare',
    industries: 'Healthcare',
    batch: 'S24',
  },
  {
    name: 'Mito Health',
    longDescription:
      'Mito Health uses blood work and scans to tell our customers what to do to prevent disease and live longer. Customers love having a health expert in their pocket, who knows all about them, and can offer trusted advice. Our program has already helped customers detect cancer early and cut their risk of heart disease.',
    tags: 'Anti-Aging, Artificial Intelligence, Consumer Health Services, Health Tech, Digital Health',
    industries: 'Healthcare, Consumer Health and Wellness',
    batch: 'S24',
  },
  {
    name: 'Lighthouz AI',
    longDescription:
      "Lighthouz AI is building AI procurement specialists for manufacturers.  500k procurement professionals spend 90% of their day emailing suppliers and entering data on spreadsheets and outdated ERP.  Lighthouz's AI procurement specialists disrupts this entire profession. It 15x'es the productivity of procurement teams. It automates all manual procurement tasks including data verification and entry on ERP. Our AI agents will replace 500k jobs in the next 10 years.  Our team has 20+ years of combined AI experience:  - Srijan has been a GaTech CS professor, research scientist @ Google, postdoc @ Stanford AI lab, PhD @ UMD, BTech @ IIT. He has built AI  systems now in production at Meta, Home Depot, etc. He has written 60+ papers that are cited 6000+ times.  - Sonali was a lead AI engineer at Progressive insurance, American Family insurance, Halliburton, did her MS at University of Washington, and undergrad at IIT. ",
    tags: 'SaaS, Workflow Automation, Supply Chain, AI, AI Assistant',
    industries: 'B2B',
    batch: 'S24',
  },
  {
    name: 'Modus',
    longDescription:
      'Modus helps companies hire and retain only the people they need instead of becoming bloated messes. Modus connects your HRIS, ATS, and analyzes extensive data across your organization so leaders can detect, inspect, and correct their workforce plans - without relying on spreadsheets or complex systems.    Lin experienced these challenges firsthand as a VP BizOps at HashiCorp, scaling from 100 employees to IPO, while Chris and Amar faced similar issues scaling 40+ person teams as a fractional CTO. They’re motivated by the belief that companies should have the least number of employees possible. ',
    tags: 'Artificial Intelligence, Finance, B2B, HR Tech, Operations',
    industries: 'B2B',
    batch: 'S24',
  },
  {
    name: 'dmodel',
    longDescription:
      'dmodel lets companies look inside the mind of an AI model and manipulate its thoughts in real-time. For example, AI-driven customer service platforms can use dmodel to rapidly fine-tune responses for accuracy and brand alignment, without retraining the entire model.',
    tags: 'Generative AI, SaaS, Compliance, API, AI',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'S24',
  },
  {
    name: 'LedgerUp',
    longDescription:
      'LedgerUp is your AI RevOps teammate for B2B SaaS, transforming contract-based billing from a chore into a frictionless, revenue-accelerating process. We parse contracts, issue invoices, and collect payments in real-time, all while surfacing actionable analytics—allowing your finance team to escape spreadsheet chaos and focus on strategic growth. Just close deals and let us handle your RevOps for you.',
    tags: 'FinOps, Workflow Automation, AI',
    industries: 'B2B, Finance and Accounting',
    batch: 'S24',
  },
  {
    name: 'Plume',
    longDescription:
      "Plume is an energy renovation copilot that helps real estate agents and contractors with energy audits and renovation planning. Our first customer, a real estate marketplace, uses Plume to provide potential buyers with precise energy renovation scenarios, cutting the time to sell a house in half. Using thermodynamic models, public housing data, satellite imagery and AI,  Plume enables remote energy assessments of any building. In Europe alone, 35 million homes face regulatory pressure to be retrofitted within the next 5 years, and 220 million over the next 25 years. Plume leverages the founding team's unique expertise: Marc, a Harvard satellite researcher; JB, a thermodynamics engineer; and Edouard, a sales and product builder from Palantir.",
    tags: 'SaaS, Real Estate, Climate, Renewable Energy, ClimateTech',
    industries: 'Industrials, Climate',
    batch: 'S24',
  },
  {
    name: 'Pulse AI',
    longDescription:
      'Pulse converts complex information into LLM-ready inputs. Our API supports all document formats, from PDFs to Word, Excel, etc. Pulse integrates seamlessly with any existing data pipeline in minutes without any training or complexity. ',
    tags: 'Generative AI, SaaS, B2B, Data Engineering, Enterprise Software',
    industries: 'B2B, Infrastructure',
    batch: 'S24',
  },
  {
    name: 'AutoPallet Robotics',
    longDescription:
      'We’re building the next generation of warehouse robotics. In the US today, retailers spend approximately $10B per year paying human laborers to pick up and move cardboard boxes in warehouses. Existing solutions for automating this are expensive and difficult to install, which is why manual operation is still so prevalent. Our solution is different. We make swarms of small mobile robots that install into existing warehouses to provide a low-cost and robust automation solution for case picking and mixed-SKU palletization. Our novel technology allows these robots to be installed and operate at significantly lower cost than existing solutions while being both flexible and robust.',
    tags: 'Hard Tech, Machine Learning, Warehouse Management Tech, Swarm Robotics, Automation',
    industries: 'Industrials, Manufacturing and Robotics',
    batch: 'S24',
  },
  {
    name: 'stormy.ai',
    longDescription:
      'Influencer marketing is a pain to set up. Founders spend hours scrolling the feed, DMing content creators, negotiating deals and paying them. We hated that process. So we fully automated it with AI. Now, you can focus on building and let Stormy handle the distribution!',
    tags: 'SaaS, B2B, Marketing, AI',
    industries: 'B2B, Marketing',
    batch: 'S24',
  },
  {
    name: 'Merse',
    longDescription:
      'Visual stories like comics, but with voices and sound effects. Building a new medium to rival Youtube, TikTok, and Netflix.',
    tags: 'Generative AI, Consumer, Entertainment, AI',
    industries: 'Consumer',
    batch: 'S24',
  },
  {
    name: 'AminoAnalytica',
    longDescription:
      "Biotechs use proteins found in nature, such as enzymes in bacteria or peptides in lizards, in a wide range of applications from chemical manufacturing to therapeutics. However, these naturally occurring proteins aren't optimized for industry. At AminoAnalytica, we specialize in AI-powered protein optimization. Using our proprietary computational tools, we can improve the properties of a target protein sequence, from the stability of therapeutic peptides to the activity of industrial enzymes. When we optimize a protein, it’s not just a theoretical suggestion—we work with labs to ensure that it’s functional, stable, and ready to change the world.",
    tags: 'Synthetic Biology, Biotech, Manufacturing, Climate, Industrial',
    industries: 'Healthcare, Industrial Bio',
    batch: 'S24',
  },
  {
    name: 'Gauge',
    longDescription:
      "Gauge is solving the monolith/microservices dilemma. We’re helping enterprises break large codebases into small pieces. We first met as roommates in college, and in the decade since we've both worked exclusively at startups, including multiple founding engineering roles. We ran into this problem time and time again as our startups began to scale. We're now working with a wide range of companies, including a number of multi-billion $ enterprises. Our open source tooling also has ~1k stars on GitHub, over 400k downloads, and is in use by Nvidia. In the short term, Gauge is building tools to modularize the monolith. Long term, Gauge is building a way to deploy a single codebase as a set of independent services, giving you the scalability of microservices alongside the simplicity of monolithic development. ",
    tags: 'Developer Tools, SaaS, B2B, Open Source, Web Development',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'S24',
  },
  {
    name: 'Weave Robotics',
    longDescription:
      "Making the world’s first personal robot that's built for the home.  Our robot, Isaac, will autonomously tidy up endless messes, fold laundry, and care for your home while you’re away, and we’re shipping our first 30 in fall of 2025.",
    tags: '',
    industries: 'Industrials, Manufacturing and Robotics',
    batch: 'S24',
  },
  {
    name: 'Tandem',
    longDescription:
      'The pandemic reduced office use nationwide by 50%, and tenants have been left to deal with highly inflexible, long term lease agreements that don’t fit today’s office use patterns. The traditional brokerage model works great for big spaces and long terms. But when you want to talk smaller units, short term lengths, shared and common areas, you’re out of luck.  Tandem is an AI-enabled office leasing platform. We’re using technology to unlock flexible, month-to-month agreements in quality, ready-to-go spaces.   Our AI co-pilot enables a white-glove-quality B2B office search experience, with a fraction of the human labor typically required. Today we’re serving two primary markets — NY & SF, with hundreds of active Hosts in each.  We’ve helped match more than 100 companies and have seen double-digit month-over-month growth.',
    tags: 'Marketplace, Real Estate, B2B',
    industries: 'B2B, Office Management',
    batch: 'S24',
  },
  {
    name: 'AnswerGrid',
    longDescription:
      'AnswerGrid is an AI-powered enterprise search platform purpose-built for consultants to leverage their firm’s institutional knowledge.',
    tags: 'Artificial Intelligence, Generative AI, Productivity',
    industries: 'B2B, Productivity',
    batch: 'S24',
  },
  {
    name: 'Tivara',
    longDescription: '',
    tags: 'Artificial Intelligence, SaaS, B2B, Healthcare',
    industries: 'Healthcare',
    batch: 'S24',
  },
  {
    name: 'camfer',
    longDescription:
      'We’re building the first AI mechanical engineer that collaborates with humans to do design tasks end-to-end. Human engineers can talk to camfer to build, test, and iterate 3D designs natively on CAD platforms.',
    tags: 'Generative AI, Hardware, Productivity, Manufacturing, AI',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'S24',
  },
  {
    name: 'MinusX',
    longDescription:
      'MinusX is a chrome extension that adds a side chat to your analytics apps (Jupyter, Metabase, Grafana, Tableau, etc). Given an instruction, our agent operates your apps - by clicking & typing, just like you do - to analyze data and answer queries. We believe an AI Data Scientist is a scientist, not yet-another-new-analytics-platform. MinusX interoperates with you in tools you already love and use, and as a matter of philosophy, gets out of the way.',
    tags: 'Machine Learning, Analytics, Data Science, AI, AI Assistant',
    industries: 'B2B, Analytics',
    batch: 'S24',
  },
  {
    name: 'Snowpilot',
    longDescription:
      "Snowpilot combines a spreadsheet UI with a federated data engine. We get live data from tools like Salesforce, Gong, and Mixpanel, enabling PMs, marketers, and salespeople to run high-impact workflows with data at any scale. Ben and Dom met at a Sequoia & a16z-backed data startup, Census. Together, we built the first real-time, warehouse-native customer data platform. Prior to that, Dom led 20+ ML engineers at Adobe to build their internal ad optimization platform, which allocates $1B in annual spend. Ben built the microservices stack powering the new Microsoft Edge, scaling from 0 to hundreds of millions of DAUs. We started coding Snowpilot in mid-August '24, and we already have a live app that can run sub-second queries on millions of rows, entirely in the user's browser. The data warehouse market is $10B/yr, growing 23% YOY. We will disrupt incumbents and significantly expand this market by enabling non-engineers to use big data on a daily basis.",
    tags: 'B2B, Big Data, Data Engineering, AI, Databases',
    industries: 'B2B',
    batch: 'S24',
  },
  {
    name: 'Passage',
    longDescription:
      'Passage is a co-pilot for the customs brokering space.  Today, companies employ entire teams of customs brokers and entry writers who spend hours keying in data and corresponding with clients.  With our co-pilot, we plan to streamline this tedious data entry work, and email correspondence, making compliance teams significantly more efficient',
    tags: 'Generative AI, B2B, Logistics, Transportation, AI',
    industries: 'B2B, Supply Chain and Logistics',
    batch: 'S24',
  },
  {
    name: 'Parahelp',
    longDescription:
      'Parahelp is an AI support agent for software companies. Unlike other chatbots, Parahelp can resolve complex support tickets end-to-end, such as troubleshooting product issues and managing subscriptions, by following your policies and using your existing knowledge base, tools (like Stripe, Slack, and Linear), and API endpoints.',
    tags: 'Artificial Intelligence, B2B, Customer Service, Customer Support, Ticketing',
    industries: 'B2B, Operations',
    batch: 'S24',
  },
  {
    name: 'CodeViz',
    longDescription:
      'CodeViz creates interactive maps of codebases to help engineers quickly understand and navigate code.    Adopted by engineers at Amazon, Microsoft, and Roblox, CodeViz was founded by two ex-Tesla engineers to tackle the 75% of development time lost to reading code. Download today at https://codeviz.ai',
    tags: 'Developer Tools, Productivity, AI',
    industries: 'B2B, Productivity',
    batch: 'S24',
  },
  {
    name: 'RunLocal',
    longDescription:
      'RunLocal helps engineering teams discover, optimize, evaluate and deploy the best on-device AI model for their use case. ',
    tags: 'Artificial Intelligence, Developer Tools, Machine Learning, DevOps',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'S24',
  },
  {
    name: 'Ares Industries',
    longDescription: '',
    tags: 'Aerospace, Industrial',
    industries: 'Industrials, Aviation and Space',
    batch: 'S24',
  },
  {
    name: 'Dodo',
    longDescription:
      "Dodo develops AI employees for specialty clinics, starting with veterinarians, fine-tuned on industry-specific knowledge and trained on protocols taken directly from employee manuals and playbooks, which often span multiple binders.  Clinics hire Dodo's labor-as-a-software to handle front and back-office tasks, enabling clinics to provide 24/7 service. Dodo answers calls, sends medical records, and refills prescriptions—fully autonomously, with no human in the loop.",
    tags: 'Healthcare, Healthcare IT, Call Center, Conversational AI, AI Assistant',
    industries: 'Healthcare, Healthcare IT',
    batch: 'S24',
  },
  {
    name: 'Lucible',
    longDescription:
      "Lucible is a combined checking and investment account that allows you to invest 100% of your money while still being able to spend it. Whenever you spend, we issue a loan in real time, using your investments as collateral, to cover the cost. This is the most capital and tax efficient way to manage your money. It's what the ultra wealthy already do to finance large purchases, and now you can do it for every day spending.",
    tags: 'Fintech, Investing, Neobank',
    industries: 'B2B, Operations',
    batch: 'S24',
  },
  {
    name: 'Elevate',
    longDescription:
      'We use AI to streamline data integrations for mergers & acquisitions (M&A), with a focus on private equity (PE)-backed roll-ups. We take messy data (e.g., customer, financial, operational) that sits across disparate systems in different formats and use LLMs to unify, clean, and enrich it. Our approach expedites speed to value capture post-acquisition without distracting management teams or requiring expensive data engineering resources.  Our experience is at the intersection of finance x tech. With an increasingly competitive M&A marketplace driven by $0.5T+ of dry powder, clean, usable data is a massive competitive advantage throughout the investment cycle – in diligence, to make informed investment decisions; in value creation, to execute the strategic plan quickly and confidently; and in exit, where better data leads to better outcomes.  We’re on a mission to make AI useful for any company with messy data. ',
    tags: 'AIOps, Artificial Intelligence, Finance, B2B, Automation',
    industries: 'B2B',
    batch: 'S24',
  },
  {
    name: 'Offstream',
    longDescription:
      'Offstream is Vanta for carbon compliance.  Today, every new infrastructure project, from data centers to biomass power plants has a complicated mess of local, state, federal, and private sector standards that they must understand and comply with to make their projects profitable. Offstream solves this by using LLMs to parse regulations, generate technical reports for customers, and manage 100,000+ operational data points on project’s lifecycles. We cut the time customers spend on compliance by 90% and at 1/5th of the cost of alternatives.',
    tags: '',
    industries: 'B2B',
    batch: 'S24',
  },
  {
    name: 'Storia AI',
    longDescription:
      "With AI increasingly automating away code generation, software engineers will spend more time reading, judging, and architecting code rather than writing it. Storia is building an open-source copilot that knows a company's codebase and its context. We are starting with Sage, a Perplexity-like agent for helping developers understand, judge, and generate software. Given an existing codebase, developers can ask Sage questions such as: 1) Given my project’s SLA and latency constraints, what is the appropriate underlying vector database to use? How would I incorporate it into my existing codebase? 2) Why should I pick Redis over Milvus as my underlying vector store? 3) Does this codebase in our organization still work and what steps are required for a complex integration with another library? Sage’s answers are directly supported by documentation and external references like GitHub, Stack Overflow, technical design documents, and project management software, preventing hallucinations. Today, Sage has up-to-date knowledge about open-source repositories (indexed daily). Tomorrow it will have a deep understanding of every line of code on the Internet. For teams, Sage will know about your private codebase too. No group has yet solved how to build an AI system that comprehends a codebase and its context and can empower every developer to architect better code, faster. This requires new research advances because vanilla RAG and out-of-the-box LLMs aren’t going to cut it.  We have 20+ years of software engineering and AI research experience. Julia worked on precursors of Gemini using contextual neural techniques before they were called “RAG” (and applied it to products like Google Keyboard and Pixel phones). Mihail built the earliest LLMs at Amazon Alexa and launched the first contextual deep learning conversational AI system in production at Alexa. ",
    tags: 'Artificial Intelligence, Developer Tools, Machine Learning, SaaS',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'S24',
  },
  {
    name: 'DeepSim, Inc.',
    longDescription:
      'DeepSim is building an AI physics simulator. We are currently developing the only thermal simulator to meet AI chip design needs and are validating our tool with Intel. We are a team of three electrical engineering PhDs from Stanford with backgrounds in semiconductor fabrication and design.',
    tags: 'Artificial Intelligence, B2B, Semiconductors',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'S24',
  },
  {
    name: 'reworks',
    longDescription:
      "reworks is the fastest way for agentic AI companies to integrate with external software. Instead of spending weeks integrating with traditional API:s or writing custom scraping scripts, teams use reworks to build browser-based integrations that don't break.",
    tags: 'Artificial Intelligence, Generative AI, SaaS, API, AI',
    industries: 'B2B, Productivity',
    batch: 'S24',
  },
  {
    name: 'Zuni',
    longDescription: '',
    tags: 'Generative AI, Productivity, Email, AI Assistant',
    industries: 'B2B, Productivity',
    batch: 'S24',
  },
  {
    name: 'Proxis',
    longDescription:
      'Proxis is the first dedicated platform for LLM distillation and serving, unlocking production ready models at 1/10th the cost. Jackson (CTO) optimized the Gemini model at Google for efficient deployment at massive scale. Liam (CEO) built zero-to-one systems as a software engineer. Fine-tuning frontier models like GPT-4 on proprietary data is expensive, and locks customers into one external closed source model provider.  To solve this, enterprise AI teams can use Proxis to distill state-of-the-art Llama 405b into an efficient model tuned on their own data, which is 5x faster and 10x cheaper than closed source alternatives.',
    tags: 'Artificial Intelligence, Generative AI, Cloud Computing, AI',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'S24',
  },
  {
    name: 'Rewbi',
    longDescription:
      'Rewbi uses AI to optimize grid-connected battery storage. We generate revenue by charging when electricity is cheap and discharging when electricity is expensive. We rent battery storage for a fixed fee per month, and we earn 2x that fee in monthly revenue by dispatching the battery optimally. Today, power companies use human traders to manually track grid conditions and update the battery’s dispatch schedule. However batteries can adjust their power output 100x faster than traditional power generation (e.g. hydro, coal, nuclear, gas), with the ability to go from full-speed charging to to full speed discharging in under a minute. Electricity prices change every 5 minutes, often by 300% or more. Our AI better tracks 100s of live inputs, and it makes decisions faster than a human operator (with lower overhead!), improving revenue 2x.',
    tags: '',
    industries: 'Industrials, Energy',
    batch: 'S24',
  },
  {
    name: 'Willow',
    longDescription:
      'Willow is an AI-powered revenue cycle management software. Starting with the intake and coding process for skilled nursing facilities, we maximize reimbursement by converting complex clinical paperwork into accurate diagnoses and ICD codes.   We built Willow after seeing how nursing homes struggle with revenue cycle challenges that result in lost revenue and claim denials. Traditional processes are outdated and prone to errors, with no solution tailored to the complexities of long-term care. Our AI-driven platform addresses this gap, simplifying operations and reducing costly mistakes so staff can focus on delivering quality patient care.   Over $490 billion is spent annually on long-term care in the US. With the growing demand and increasing complexity of insurance billing, Willow ensures long-term care providers capture the full value of their services. ',
    tags: 'Artificial Intelligence, Health Tech, B2B, Healthcare, Health Insurance',
    industries: 'B2B',
    batch: 'S24',
  },
  {
    name: 'Aviary',
    longDescription:
      'Aviary Notebook is an AI-powered video notebook that helps you learn faster from videos, and to share and collaborate with video notes.',
    tags: 'AI-Enhanced Learning, Artificial Intelligence, Machine Learning, Video, Search',
    industries: 'Consumer',
    batch: 'S24',
  },
  {
    name: 'NetworkOcean',
    longDescription:
      'We build underwater data centers to cut power usage by up to 30%, operating GPUs cheaper and more sustainably. Our 1 MW capsule is being tested underwater in the SF Bay ',
    tags: 'Hard Tech, Hardware, Cloud Computing, ClimateTech, AI',
    industries: 'Industrials, Climate',
    batch: 'S24',
  },
  {
    name: 'Silurian',
    longDescription:
      'Silurian is building foundation models for simulating Earth, starting with weather. From assessing the risk of wildfires to predicting the energy grid load, we provide an infrastructure layer for our planet. Our frontier models push the boundaries of what can be simulated on Earth and improve decision making across vital sectors including energy, insurance, agriculture, and logistics.  ',
    tags: 'Artificial Intelligence, Climate, Insurance, Agriculture, Energy',
    industries: 'Industrials, Climate',
    batch: 'S24',
  },
  {
    name: 'Kura',
    longDescription:
      "Kura is a DevOps copilot that helps software teams manage their cloud infrastructure.  Kura integrates directly with services like AWS to help respond to incidents, provision resources, and search over your entire cloud. Developers today spend 30% of their time managing cloud infra, and we cut that by 10x so teams can get back to shipping features quickly. Kura's founding team includes CEO Mark Dawson, an engineer and second time founder, and CTO Trevor Reed, former Google engineer and Mars Rover driver at NASA JPL.",
    tags: 'Developer Tools, DevOps, Cloud Computing, Infrastructure, AI Assistant',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'S24',
  },
  {
    name: 'Unbound Security',
    longDescription: '',
    tags: '',
    industries: 'B2B, Security',
    batch: 'S24',
  },
  {
    name: 'RetroFix AI',
    longDescription:
      'RetroFix is a web platform that allows contractors to automatically apply for tax incentives and sustainability credits. Currently, contractors rarely apply for credits because discovering incentives, checking eligibility, and applying are all done manually via emails and phone calls with local utilities and/or government offices. RetroFix consolidates information on government incentives and allows building managers/contractors to apply in minutes, saving hundreds of thousands of dollars per building. ',
    tags: 'Artificial Intelligence, SaaS, Proptech, Climate',
    industries: 'Industrials, Climate',
    batch: 'S24',
  },
  {
    name: 'Azalea Robotics Corporation',
    longDescription:
      'Azalea Robotics automates airport baggage handling with intelligent robot operations. The global market for airport baggage handling systems is $20+ billion and growing, presenting a significant opportunity for innovation and market disruption in this sector. Passenger air traffic volume is increasing, driving demand for efficient and reliable baggage handling at airports and putting immense pressure on existing infrastructure. In 2023 alone, airports processed approximately 4.5 billion bags, highlighting the need for advanced solutions to manage this load effectively. Azalea Robotics provides state-of-the-art robotic systems that enhance efficiency, reduce mishandling, and improve passenger experience through more reliable operations. Baggage handling is a critical component of airline ground operations, yet it is fraught with challenges. The work is physically demanding, often leading to long-term injuries among workers. Traditional baggage handling involves repetitive lifting and maneuvering of heavy loads, which can result in long-term health issues. Azalea Robotics addresses these challenges by automating the most strenuous tasks, thereby reducing the risk of injury and enhancing operational efficiency.',
    tags: '',
    industries: 'Industrials, Manufacturing and Robotics',
    batch: 'S24',
  },
  {
    name: 'Decisional AI',
    longDescription:
      'Decisional is building an AI Financial Analyst for Private Market Investors that pulls information from public and private data sources. Financial Services firms like LTV Capital use our AI Agent to gain superhuman abilities like gleaning insights from thousands of data rooms or documents & magically modelling spreadsheets in seconds',
    tags: 'Artificial Intelligence, Fintech, SaaS, Finance, B2B',
    industries: 'Fintech',
    batch: 'S24',
  },
  {
    name: 'Moonglow',
    longDescription:
      'Moonglow is a no-code platform for building browser agents. Users record their workflow once, and then our platform builds and deploys browser agents that automate their repetitive workflows. Previously, Leila was a software engineer at Jane Street. She led the build-out of its equities clearinghouse connectivity infrastructure and was the technical lead of its front-office SRE team. Trevor was part of Hazy Research Lab at Stanford, and published machine learning research at NeurIPS, ICLR and ACL. https://moonglow.ai',
    tags: 'Artificial Intelligence, Developer Tools, Machine Learning, Robotic Process Automation, Infrastructure',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'S24',
  },
  {
    name: 'ideate.xyz',
    longDescription:
      'ideate.xyz is a graphics design as API platform. We help founders, marketing teams and agencies scale their marketing graphics design assets programmatically.',
    tags: 'Developer Tools, Generative AI, SaaS, Design, Design Tools',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'S24',
  },
  {
    name: 'FirstWork',
    longDescription:
      'Firstwork is a next-generation HR platform designed specifically for companies with dynamic workforce needs. Our mission is to streamline and automate key HR processes to help businesses operate more efficiently and effectively. What We Do (for now): (1) Smart Onboarding 📋: Our platform simplifies the onboarding process by automating the collection and verification of credentials, such as right-to-work documents, insurance forms and driver’s licenses. This reduces administrative burden and accelerates the time-to-productivity for new hires. (2) AI-Assisted Activation 🤖: Leveraging AI, we enhance communication and messaging for new hires, ensuring they receive timely and relevant information. This helps in better engagement and faster integration into their roles. (3) Perpetual Compliance ✅: Our system uses AI and OCR technology to continuously monitor and ensure compliance with various regulatory requirements. This includes tracking expirations of critical documents, updating records, and generating compliance reports, thus reducing the risk of penalties and legal issues. ',
    tags: 'SaaS, Human Resources, Workflow Automation, Compliance, AI',
    industries: 'B2B, Human Resources',
    batch: 'S24',
  },
  {
    name: 'Sorcerer',
    longDescription:
      'Sorcerer builds weather balloons that collect 1000x more data than traditional systems. We have $5.5+ of signed LOIs with the US National Weather Service, the Department of Defense, and the government of El Salvador.',
    tags: 'Hard Tech, Climate, Aerospace, AI',
    industries: 'Industrials, Climate',
    batch: 'S24',
  },
  {
    name: 'Wordware',
    longDescription:
      '1. Collaborative IDE for Building AI Agents  2. At its heart is a new programming language that merges plain English with concepts like loops, conditional statements, and function calling. 3. We also support forking, API deployment and sharing as a hosted app. We have 300,000 users, and many companies paying us between 199 and 10k per month.',
    tags: 'AIOps, Developer Tools, Infrastructure, AI',
    industries: 'B2B, Infrastructure',
    batch: 'S24',
  },
  {
    name: 'Maitai',
    longDescription:
      'Maitai makes building reliable AI applications easy. We autocorrect faulty model output in real-time and automatically fine-tune models that learn from their mistakes. This means our customers get more reliable results immediately, and over time, they gain custom models built specifically for their application that only get better and faster. You wouldn’t hire an employee who doesn’t learn from their mistakes—so why use a model that doesn’t? Maitai is here to deliver the next generation of reliable AI inference.',
    tags: 'Artificial Intelligence, Developer Tools, SaaS, B2B',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'S24',
  },
  {
    name: 'Corgi',
    longDescription:
      'Corgi is building the first full stack AI insurance carrier. Insurance is 12% of US GDP. We’re taking it all.',
    tags: 'Fintech, Insurance, AI',
    industries: 'Fintech, Insurance',
    batch: 'S24',
  },
  {
    name: 'Phonely',
    longDescription:
      "Phonely uses existing call recordings to create a 'AI vocal twin' that can answer customer support calls and match or outperform call center agents. On top of that we've built a Zapier like workflow that lets businesses connect to software or transfer calls just like a person would. Our platform sits on proprietary deterministic LLM that is both cheaper and more accurate than gpt-4o for call center inquiries.",
    tags: '',
    industries: 'B2B',
    batch: 'S24',
  },
  {
    name: 'VideoGen',
    longDescription:
      'VideoGen makes it easy for anyone to create professional, copyright-free videos in seconds. Today, we serve thousands of customers, from individuals and small businesses to teams at Google and ByteDance. Making videos is hard, time-consuming, and expensive if you hire someone to do it for you. With VideoGen, it only takes a few clicks!',
    tags: 'Artificial Intelligence, Generative AI, SaaS, Video',
    industries: 'B2B',
    batch: 'S24',
  },
  {
    name: 'Clara',
    longDescription:
      "Clara is Deel/Rippling for in-home senior care. We provide an all-in-one payroll, tax, and insurance platform for families to directly employ caregivers, and a marketplace for them to discover and match with their ideal caregiver from our network of hundreds of qualified local care providers. Clara was founded by two former Uber colleagues who have experienced the challenges of managing care for a loved one personally, and are inspired by the opportunity to apply their tech backgrounds to solving the most widespread and impactful issues in the >$120B in-home care industry.  Clara's marketplace is currently live in the SF Bay Area, delivering hundreds of hours of care to local families. Our consumer-facing senior-care payroll and tax management solution is live nationwide.",
    tags: '',
    industries: 'Healthcare, Consumer Health and Wellness',
    batch: 'S24',
  },
  {
    name: 'Stack Auth',
    longDescription:
      'Stack is the open-source authN, authZ, and user management platform. We build for devs who want to iterate quickly, offering both managed auth and self-hosting. You can set it up in one minute and scale with the project as it grows. Stack was built by repeat founders with strong technical backgrounds. Check out our GitHub: https://github.com/stack-auth/stack',
    tags: '',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'S24',
  },
  {
    name: 'Tabular',
    longDescription:
      'Tabular uses AI to automate the core workflows of accounting firms, starting in Europe. We generate finished ledger entries that users export with just one click. This involves tasks like booking expense accounts, determining VAT filings, reconciling transactions.',
    tags: '',
    industries: 'B2B, Finance and Accounting',
    batch: 'S24',
  },
  {
    name: 'Callback',
    longDescription:
      'Callback is AI-native business process outsourcing. We help our customers stay focused on their core business while we use AI to automate tasks like invoice processing, PDF report parsing, and data labeling.  ',
    tags: 'AIOps, B2B, Automation, Operations',
    industries: 'B2B, Operations',
    batch: 'S24',
  },
  {
    name: 'Flyflow',
    longDescription:
      '"I don’t know how I would have found these leads myself."  - YC Founder Flyflow enables companies to find prospective customers using AI workflows instead of drowning in tables. Try out our product at app.flyflow.ai. How are we different? (1) Higher quality leads: get to a list that’s so relevant, you’ll want to spend time getting introduced to people there, instead of sending another 1,000 cold emails (2) Incredibly easy to set up: get up and running with a list of prospects in hand  in under 10 minutes (3) Integrate the best of different sales tools all in one place: no need to switch between different tabs for web research, filtering by company size, and finding prospect LinkedIns',
    tags: '',
    industries: 'B2B, Sales',
    batch: 'S24',
  },
  {
    name: 'Bayesline',
    longDescription:
      "Bayesline is building a GPU-powered financial analytics suite for institutional investors, like hedge funds.  Clients use our cloud deployed solution to build custom analytics in seconds, having previously been frustrated with off the shelf solutions that don't generate any alpha. What used to take weeks or months now happens near instantly.  Sebastian, CFA (ex Bloomberg Quant & AI Research) and Misha, PhD (ex BlackRock Managing Director) met while working at BlackRock in 2016. With a combined 20 years of experience in the space they set out to change the way the industry uses analytics - from one size doesn't fit all to truly tailored to clients' needs.",
    tags: 'Fintech, Finance, B2B, Analytics, AI',
    industries: 'Fintech, Asset Management',
    batch: 'S24',
  },
  {
    name: 'DigitalCarbon',
    longDescription:
      'Digitalcarbon transforms ordinary images and videos into interactive, photorealistic 3D environments. Our technology can take photos from any device and render 3D scenes at more than 100 frames per second on everyday devices.  The founders were the first and second hires at a previous YC company AssemblyAI, and have more than 8 years of experience building AI models.  Creating immersive 3D experiences typically requires complex equipment and suffers from slow rendering speeds. This has limited the adoption of 3D technology across various industries. Digitalcarbon fixes that, eliminating the need for specialized equipment and dramatically accelerating the rendering process. Our technology enables applications across various industries: * Real estate: Creating virtual property tours that feel remarkably lifelike * E-commerce: Providing interactive 3D product visualizations to boost consumer experience * Tourism: Helping tourist businesses attract more travelers with immersive virtual previews * Drone mapping and inspection: Enhancing aerial surveys and structural assessments with detailed 3D models Think Unreal Engine meets Matterport with no hardware, but faster, editable, and more accessible for businesses of all sizes.',
    tags: 'Computer Vision, Real Estate, B2B, E-commerce, AI',
    industries: 'B2B',
    batch: 'S24',
  },
  {
    name: 'Random Labs',
    longDescription:
      "We are building a fully local opensource software engineer. Software thrives on opensource tools and it's only right that this technology be built for all to use.",
    tags: 'Artificial Intelligence, Developer Tools, Open Source, AI Assistant',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'S24',
  },
  {
    name: 'Unsloth AI',
    longDescription:
      "Unsloth helps builders create custom models better & faster. We're developing the all in one solution to help you create highly-accurate custom models 30x faster with 90% less memory use. With over 15 million monthly model downloads and 15K GitHub stars, our mission is to make fine-tuning and open-source the best it can be!",
    tags: 'Generative AI, Open Source, No-code, Cloud Computing, AI',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'S24',
  },
  {
    name: 'Codes Health',
    longDescription:
      'Codes automates patient record collection. Today, documents are scattered across EHRs, other doctors, and faxes; we use AI to compile & analyze docs.',
    tags: 'Health Tech, B2B, Healthcare, AI, AI Assistant',
    industries: 'Healthcare',
    batch: 'S24',
  },
  {
    name: 'Entangl',
    longDescription:
      'Entangl is automating engineering design. Starting with datacenter design, our AI agent automatically detects issues while engineering teams work. For each issue detected, Entangl suggests a detailed step-by-step solution. 20,000 datacenters are being built every year, making this a massive market. ',
    tags: 'Artificial Intelligence, Aerospace, Enterprise Software, Automation, Automotive',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'S24',
  },
  {
    name: 'ClaimSorted',
    longDescription:
      'ClaimSorted helps insurance companies remove the hassle of managing claims by enabling them to outsource their claim operations to us. This service is known as a Third Party Administrator (TPA). Unlike traditional TPAs, we blend AI and best-in-class experts to deliver a 5-star customer experience, minimise mistakes and speed up claim assessment.',
    tags: '',
    industries: 'Fintech, Insurance',
    batch: 'S24',
  },
  {
    name: 'mdhub',
    longDescription:
      'mdhub is building AI assistants for mental health clinics to efficiently run their operations.  Instead of seeing patients, mental health clinicians spend 50% of their time on other tasks, delaying access to mental health care. We aim to help mental health clinicians become 10x more efficient with mdhub by automating everything that occurs before, during, and after they see patients. ',
    tags: 'Artificial Intelligence, Machine Learning, Digital Health, Healthcare, Mental Health',
    industries: 'Healthcare',
    batch: 'S24',
  },
  {
    name: 'Hamming AI',
    longDescription:
      'Humans make billions of calls/day. We think a majority of these will be handled by AI built by thousands of companies tackling every single vertical. Making these AI voice agents reliable is hard. A small change in prompts, function call definitions, or model providers can cause large changes in LLM outputs.  Hamming automates testing for AI voice agents. Our voice agents call your voice agent. An AI drive-through startup uses Hamming to simulate thousands of simultaneous phone calls to achieve 99.99% agent order accuracy. We have a proven track record of helping enterprises win with AI. Sumanyu (CEO) previously helped Citizen (safety app) grow its users by 4X and grew an AI-powered sales program to 100s of millions in revenue/year at Tesla. Marius (CTO) previously ran data infrastructure @ Anduril and was a founding engineer @ Spell (MLOps startup acquired by Reddit).',
    tags: '',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'S24',
  },
  {
    name: 'Rides',
    longDescription:
      "Rides is a car community platform built for and by enthusiasts. We want to give people a purpose built way to connect with other people that share their love of cars & motorcycles and creates showcases that give every vehicle a page that let's its design, performance, modifications & story take center stage. A social network where the cars shine and the community connects exactly how we do offline and on the road... around a shared passion.",
    tags: 'Consumer, Community, Social, Automotive',
    industries: 'Consumer, Social',
    batch: 'S24',
  },
  {
    name: 'ProhostAI',
    longDescription:
      'ProhostAI is building an AI Property Manager for short-term rental hosts on Airbnb and other platforms. Our team consists of an ex-Airbnb Staff Data Scientist and Dropbox Sr Software Engineer who are also Superhosts with 9 properties worth $15M making $1.5M/yr.',
    tags: 'Artificial Intelligence, SaaS, B2B, Travel, AI Assistant',
    industries: 'B2B',
    batch: 'S24',
  },
  {
    name: 'Educato AI',
    longDescription:
      'Educato builds exam prep platforms worldwide using AI. Online exam prep has existed for decades, yet the big players all target the same top 10 exams in the US. The reality is that most exams around the world still have little to no quality online prep material, including many taken by hundreds of thousands of students each year. Educato uses AI to generate high-quality prep content for these exams. LLMs allow us to target the profitable fat middle in the distribution of exams, historically overlooked by education companies.',
    tags: 'Artificial Intelligence, Education, Edtech',
    industries: 'Education',
    batch: 'S24',
  },
  {
    name: 'Spaceium Inc',
    longDescription:
      'Spaceium builds fully automated space stations to refuel and repair spacecraft. We have secured $86.1 million in binding commercial contracts and have an additional $230 million in the pipeline. Additionally, we have 1 billion dollars in letters of intent. We have successfully tested our hardware, which will launch to space next year.  Our fully automated space stations will efficiently store and transfer both cryogenic (extremely cold) and non-cryogenic fuels with zero loss during storage and transfer. And they can transfer fuel seamlessly to any spacecraft design using our proprietary modular robotic arm. Our customers include launch vehicles, orbital transfer vehicles, moon landers, and spacecraft that benefit from increased payload capacity and extended travel capabilities. Our long-term vision is to build service hubs along the space superhighway to connect Earth to Moon and Mars and help humanity to become multi multi-planetary species ',
    tags: 'Hard Tech, Robotics, Space Exploration, Aerospace',
    industries: 'Industrials, Aviation and Space',
    batch: 'S24',
  },
  {
    name: 'Comfy Deploy',
    longDescription:
      'Comfy Deploy lets developers build and deploy workflows that use Stable Diffusion and other models to produce images and video. Instead of cobbling together fragmented tools, teams now build workflows that generate assets they need on their own. **Team ComfyUI workspace** • Replacing cobbled-together solutions with a unified, team-focused environment without the pain of self-hosting. • Eliminate "works on my machine" issues with version control. • Share storage for models and outputs. • Leverage the power of ComfyUI without the complexities of self-hosting **Powerful GPU Infrastructure** • Access managed GPUs that grow with your teams needs • Tailor the platform to your requirements by easily installing custom nodes and models **Custom configuration** • Download the models you want, stored privately in your personal volume • Install the custom nodes your workflow needs • Train models on your own datasets. **API Deployments: From workflow to production in seconds** • Transform any workflow into a fully functional API immediately without extra engineering • Comprehensive observability on every run • Built-in API authentication • TS/JS/Python/Ruby SDKs for seamless integration ',
    tags: 'Artificial Intelligence, API',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'S24',
  },
  {
    name: 'Synnax',
    longDescription:
      'We build software that helps hardware teams quickly and clearly evaluate how a component (engine, battery, valve, etc.) or process (assembly line, manufacturing plant) performs. We prevent mistakes, reduce costs, and accelerate time-to-market. Our platform unifies industrial control with sensor data storage and automated post-processing, delivering an end-to-end operations and observability stack. To put it comparatively, take LabVIEW, InfluxDB, and Grafana, wrap them into a single package, add a bit of magic, and you get Synnax.',
    tags: 'Hard Tech, Data Visualization, Time Series, Industrial, Databases',
    industries: 'B2B, Infrastructure',
    batch: 'S24',
  },
  {
    name: 'Theseus',
    longDescription:
      "We've built a Micro Visual Positioning System (VPS) that can be retrofit onto any drone that simulates a GPS. Our VPS uses cameras and an accelerometer/gyroscope as well as reference satellite imagery for positioning. The system is entirely self contained, can't be jammed and has no RF signature. ",
    tags: '',
    industries: 'Industrials, Drones',
    batch: 'S24',
  },
  {
    name: 'Saphira AI',
    longDescription:
      'Saphira is the easiest way for hardware products to get safety certified and reach market faster, such as industrial robots and heavy machinery.',
    tags: 'Robotics, Aerospace, Enterprise Software, AI, Automotive',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'S24',
  },
  {
    name: 'Glasskube',
    longDescription:
      'Managing enterprise software deployments shouldn’t feel like a balancing act. At Glasskube, we make deploying, managing, and updating software in on-premises, VPC, and air-gapped environments easier than ever. Our Mission: We empower software vendors to deliver exceptional customer experiences with less complexity. Whether you’re onboarding new clients, rolling out updates, or troubleshooting issues, our Software Distribution Platform streamlines every step. The founders have been best friends for over 15 years, lived together in college, and even had a startup together. Philip was the CTO of a European Kubernetes-based company that was acquired in 2022.',
    tags: 'Developer Tools, B2B, Open Source, Kubernetes, DevOps',
    industries: 'B2B, Infrastructure',
    batch: 'S24',
  },
  {
    name: 'Mem0',
    longDescription:
      'Mem0 provides a memory layer for LLM applications, enabling them to remember and learn from user interactions over time. ',
    tags: 'Developer Tools, Generative AI, Open Source, Infrastructure, AI',
    industries: 'B2B, Infrastructure',
    batch: 'S24',
  },
  {
    name: 'Cheers',
    longDescription:
      'Cheers is building the super-app for in-person work. Our NFC-enabled badges turn every field service interaction into a frictionless moment—easily capturing reviews, payments, and insights. Backed by YC and industry experts, we’ve proven demand and are now scaling beyond reviews to transform how millions of field employees connect with their customers.',
    tags: 'Artificial Intelligence, Analytics, Feedback, Reviews',
    industries: 'B2B',
    batch: 'S24',
  },
  {
    name: 'Ply Health',
    longDescription:
      'Ply helps behavioral health providers (e.g. therapists, social workers, psychiatrists) see more patients by getting them in network with insurance companies like Aetna or Medicaid. Ply submits enrollments 2x faster using automation and AI enabled data validation.',
    tags: 'Health Tech, Healthcare, Automation, AI',
    industries: 'Healthcare',
    batch: 'S24',
  },
  {
    name: 'Doublezero',
    longDescription:
      'Doublezero is a platform that provides developers with everything they need to build, operate, and monetize autonomous agents. Developers can focus on creating tools while Doublezero handles reasoning frameworks, state management, analytics, monetization, and a runner UI. Users can interact with agents through a powerful UI that allows play, pause, rewind, and human intervention, and discover or share agents and tools through an integrated marketplace.',
    tags: 'Artificial Intelligence, Developer Tools, Infrastructure',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'S24',
  },
  {
    name: 'Superunit',
    longDescription:
      'Superunit is building an AI powered ERP for companies manufacturing or selling physical goods.  We’ve released our first module - AI accounting and supply chain management - to 7 customers in the last 6 weeks. We’ve booked $8.3k in MRR and just signed a pilot with a $200M apparel company.  We offer automated bookkeeping, supply chain management, inventory costs, and contribution margin analysis.  Our system seamlessly integrates with Quickbooks and ERPs, eliminating manual data entry and minimizing errors. Users can interact with Superunit via Slack or email, avoiding the need to learn new software. (https://www.loom.com/share/1425f6802d774e1aa00a8ac4b64782ff) ',
    tags: 'Fintech, Machine Learning, SaaS, B2B, AI',
    industries: 'B2B, Operations',
    batch: 'S24',
  },
  {
    name: 'Undermind',
    longDescription:
      "At Undermind, we're building a search engine that can handle extremely complex questions. It’s geared at experts, like research scientists and doctors, who need to find very specific resources to solve high-stakes problems.  We’ve rebuilt search from the ground up to address this. Our new approach employs high-quality LLMs to adaptively explore a database, mimicking how a human researcher carefully discovers information. This approach dramatically outperforms (by 10-50x) traditional keyword search and other modern AI-based retrieval methods. Our first target users are the 50 million researchers searching for scientific literature on PubMed and Google Scholar every month. We’ve have users paying us $200-$500 per seat per year, from fields like medicine, ML, biotech, finance, and more.",
    tags: 'Artificial Intelligence, Machine Learning, Biotech, Search',
    industries: 'B2B',
    batch: 'S24',
  },
  {
    name: 'Domu Technology Inc.',
    longDescription:
      'Domu automates debt collection calls for the banks using generative AI. We have $870k in ARR with clients like BBVA, BNP Paribas and Skandia.',
    tags: 'AIOps, Call Center, AI, AI Assistant',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'S24',
  },
  {
    name: 'Apten',
    longDescription:
      'Apten is an AI SMS agent that automates sales and marketing for B2C service businesses. We help businesses build custom agents that drive higher lead conversion and deliver personalized messaging at scale.',
    tags: 'B2B, Sales, Marketing, SMS, AI Assistant',
    industries: 'B2B, Marketing',
    batch: 'S24',
  },
  {
    name: 'Spherecast',
    longDescription:
      'Spherecast is an AI-powered inventory management software for omni-channel e-commerce brands, supporting supply chain managers with demand planning, inventory optimization, and supplier communication. Spherecast tells brands when to reorder, how much, which warehouse to stock, and at what cost. It then autonomously executes these decisions by communicating with suppliers and manufacturers. Spherecast helps avoid stockouts and overstock, improve inventory visibility, and save time.',
    tags: 'Artificial Intelligence, SaaS, B2B, E-commerce, Supply Chain',
    industries: 'B2B, Supply Chain and Logistics',
    batch: 'S24',
  },
  {
    name: 'Miru',
    longDescription:
      'Miru provides developers with the infrastructure to easily deploy updates over-the-air to fleets of robots and IoT devices by simply pushing new changes to GitHub. We’re on a mission to accelerate the automation of the physical world by enabling developers to move atoms with bits. Our vision is simple—robots everywhere, doing everything.',
    tags: 'AIOps, Developer Tools, Robotics, IoT',
    industries: 'B2B, Infrastructure',
    batch: 'S24',
  },
  {
    name: 'CardLift',
    longDescription:
      "💸 CardLift builds co-branded browser extensions to help credit card issuers maximize their share of wallet (and in turn, per user revenue). 💸 💼 Built by the serial extension founder behind TravelArrow (the world's largest travel browser extension, 300k users, 1.5M+ ARR) and OctoShop (acquired by NYSE:IBTA), CardLift is backed by YCombinator. How it works - We build banks and credit card issuers browser extensions to help them capture a larger share of wallet among their cardholders by - 🏃 Migrating Existing Spend - When a credit card program onboards a new user, we make it dead simple for these users to switch their card-on-file at all of their top online merchants to their new card with one click. - Our AI-powered browser extension not only automatically detects where our partners' users spend the most (Netflix, Amazon, T-mobile, Progressive), but also lets them switch out their primary payment instantly. Users press a button in their browser and their card-on-file everywhere instantly switches to their shiny new card (our partner's card!). 😌 Making Checkout Seamless - Our fast checkout technology embeds “One Tap Checkout ” on the checkout page at over 50,000 e-commerce sites - making our partners' cards the easiest way for users to complete any transaction on their browser.  - They can even customize the copy to tell the user why to use your card for that specific purchase. For example Chase could prompt their users to use their Sapphire Preferred card on Avis BECAUSE it offers car rental insurance. 🤑 Making Our Partners' Cards More Rewarding - We partner with over 1000 of the country’s top merchants to offer additional affiliate-based cash back that our partners can tack on to their existing cash back. User can now earn double or even triple the cash back on Sephora when they user our partners' “One Tap Checkout” button instead of their other cards.",
    tags: '',
    industries: 'Fintech',
    batch: 'S24',
  },
  {
    name: 'Abel Police',
    longDescription:
      'Abel takes police body camera footage and turns it into completed police reports. Currently American patrol officers spend one third of their shift writing reports - turning that to zero would increase the effective police force by 50%, radically changing US cities.',
    tags: '',
    industries: 'Government',
    batch: 'S24',
  },
  {
    name: 'Ultra',
    longDescription:
      "Ultra builds AI-powered robots that automate the dull, repetitive labor still done by people in American warehouses. We’re starting with e-commerce order packaging in fulfillment centers — where a worker puts items in a box, seals it, and labels it. Traditional automation isn't working for warehouses because it's costly, rigid, and often underutilized. Ultra’s robots are different: they’re easy to deploy, adaptable, and powered by AI that’s trained through examples.",
    tags: 'Hard Tech, Robotics, Logistics, AI',
    industries: 'Industrials, Manufacturing and Robotics',
    batch: 'S24',
  },
  {
    name: 'Ångström AI',
    longDescription:
      "Angstrom AI builds GenAI-based molecular simulations to substitute wet lab experiments in the pre-clinical drug development pipeline. We are a team of 2 PhD's and 2 Professors from the University of Cambridge who decided to start a company together after we realised how to combine breakthoughs in our research in quantum-accurate models of physics and generative AI models. Our Biotech/Pharma clients can verify the efficacy and safety of new drug candidates using our computer simulations, which match the accuracy of wet lab experiments, but are over 100x faster. We achieve this accuracy by constraining our genAI-based simulations to obey the laws of physics, avoiding the hallucinations seen in other GenAI technologies. Since joining YC, Angstrom AI has developed the first physically accurate gen-AI based simulation of multiple molecules interacting. We have published the first molecule water solubility results with accuracy within the error range of wet lab experiments. We have also kicked-off a 150K pilot project with a pharma company to apply our tech to estimating solubility in their drug development pipeline.",
    tags: 'AI-powered Drug Discovery, Artificial Intelligence, Biotech, Drug discovery, AI',
    industries: 'Healthcare, Drug Discovery and Delivery',
    batch: 'S24',
  },
  {
    name: 'Coval',
    longDescription:
      "Coval is a simulation & evaluation platform for autonomous AI agents, helping engineers launch dependable assistants across chat, voice, and other modalities.  We simulate thousands of scenarios engineers don't have to manually test their agents. Our CI/CD evaluations automatically simulate and detect regressions.",
    tags: '',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'S24',
  },
  {
    name: 'Evolvere BioSciences',
    longDescription:
      '🦠🤖 We use our computational models to make next-generation antibiotics that outcompete bacterial evolution and precisely target pathogenic bacteria, without harming good microbes or human cells.  ☠️ Current antibiotics stop working because bacteria evolve resistance to them. This makes drug-resistant bacteria a looming global health crisis - already killing more people than malaria and AIDS and it is getting exponentially worse 📈.  🧬 Our approach leverages co-evolutionary protein-protein interaction datasets combined with AI to forecast bacterial mutations and create ‘future-proof’ antibiotics, addressing antibiotic resistance before it develops. This changes the game for how frequently society will need to make new antibiotics and how long our new antibiotics will be able to treat patients 👩‍⚕️. We are a team of biochemists and evolutionary biologists who met at the University of Oxford. ',
    tags: 'AI-powered Drug Discovery, Artificial Intelligence, Biotech, Therapeutics, Biotechnology',
    industries: 'Healthcare, Therapeutics',
    batch: 'S24',
  },
  {
    name: 'Spur',
    longDescription:
      'Never code up another test or hire an external QA team. We handle and automate all functional and E2E testing. ',
    tags: 'Artificial Intelligence, Developer Tools, B2B',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'S24',
  },
  {
    name: 'Ligo Biosciences',
    longDescription:
      'We are building the next generation of deep-learning models for enzyme design to slash the cost of chemical manufacturing. The $6 trillion chemical industry is flawed: It produces 20% of industrial greenhouse gases, and is responsible for 15% of global energy usage.  Enzymes offer a far more sustainable alternative to chemical synthesis and have already revolutionised how a select few chemicals are produced. The problem is each enzyme takes years of trial and error to develop. Our enzyme models learn the principles of catalysis, allowing us to design enzymes for each reaction, in days not years.  We currently have $4.3M of LOIs and have completed our first $20k contract. ',
    tags: 'Deep Learning, Synthetic Biology, Biotech, Climate, AI',
    industries: 'Healthcare, Industrial Bio',
    batch: 'S24',
  },
  {
    name: 'ACX',
    longDescription:
      'ACX is the only company that has successfully recreated synthetically the compounds that bacteria use to kill microbes for therapeutic development. Our patentable technology has applications in humans, animals, and crops. We are beginning with the elimination of crop pathogens—harmful to pests but beneficial for humans!',
    tags: 'Synthetic Biology, Biotech, Healthcare, Agriculture, Drug discovery',
    industries: 'Healthcare, Industrial Bio',
    batch: 'S24',
  },
  {
    name: 'Cracked',
    longDescription: 'Playground for Movement',
    tags: 'Artificial Intelligence, Generative AI, Design Tools, Automation, AI',
    industries: 'B2B',
    batch: 'S24',
  },
  {
    name: 'Fuse',
    longDescription:
      'AI-powered analysis of healthcare contracts and payments to help providers detect underpayments, compare their negotiated rates, and identify opportunities to boost revenue from insurers.  If you know senior finance execs in health systems, partners in healthcare PE, or mid to large sized healthcare practice owners, please do connect us. We won’t waste their time: +1 628 468 3232.',
    tags: 'Artificial Intelligence, Fintech, Payments, B2B, Healthcare',
    industries: 'Healthcare',
    batch: 'S24',
  },
  {
    name: 'Central',
    longDescription:
      'Central is an automated back-office designed for founders that handles all the bullshit required to run a compliant business like payroll, benefits, government filings, etc. Unlike traditional HR platforms that require expertise and make you do the work, Central acts as a proactive teammate that just takes of everything.',
    tags: 'Artificial Intelligence, Fintech, B2B, HR Tech, Payroll',
    industries: 'B2B, Human Resources',
    batch: 'S24',
  },
  {
    name: 'Simplex',
    longDescription:
      'Simplex enables developers to automate repetitive browser workflows using code and natural language. Developers use our SDK to create reliable automations that scale across websites.',
    tags: 'Machine Learning, Robotic Process Automation, B2B, AI',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'S24',
  },
  {
    name: 'Poka Labs',
    longDescription:
      'Poka Labs is developing an AI platform to automate operations tasks in chemical manufacturing, beginning with production scheduling. Traditionally, these tasks are performed manually using spreadsheets. Our software seamlessly integrates with existing data sources such as data historians, emails, and PDFs to automate analytics, scheduling, changes, and communication within a single platform. Malay and Andrew met while pursuing their MBAs at Harvard Business School. Malay previously worked as an engineer in the specialty chemical industry, saving his employers over $100 million across US, China, and German plants. Andrew worked as a software engineer on data infrastructure at Meta and optimization problems at a seed-stage startup. He also completed a Masters degree at Harvard specializing in Machine Learning.',
    tags: 'Artificial Intelligence, SaaS, Supply Chain, Industrial',
    industries: 'B2B, Supply Chain and Logistics',
    batch: 'S24',
  },
  {
    name: 'Invaria',
    longDescription:
      "Invaria automates logging from code to storage. We make it possible to automatically add actionable, structured event logs across your entire codebase. OTel is automated instrumentation for the ideal world, Invaria is for everyone else. Invaria was founded by three engineers who know what good looks like when it comes to observability, but also know it's takes a lot of dev effort to do manually. ",
    tags: 'Artificial Intelligence, Developer Tools, DevOps',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'S24',
  },
  {
    name: 'Indemni',
    longDescription:
      'We are building a safer supply chain. Cargo Theft has been increasing yearly, and the supply chain industry is urgently looking for ways to solve this. Using experience fighting fraud at the largest delivery marketplaces and logistics tech companies, we are building solutions to stop Cargo Theft and improve profit margins and revenue for warehouses and shippers.',
    tags: 'Identity, Logistics, Supply Chain, Fraud Prevention, Fraud Detection',
    industries: 'B2B, Supply Chain and Logistics',
    batch: 'W24',
  },
  {
    name: 'ParcelBio',
    longDescription: 'ParcelBio is delivering the next generation of RNA medicines.',
    tags: 'Gene Therapy, Biotech, Healthcare, Drug Delivery, Therapeutics',
    industries: 'Healthcare, Therapeutics',
    batch: 'W24',
  },
  {
    name: 'K-Scale Labs',
    longDescription:
      "We're building humanoid robots to do most of what you find boring or tedious. We have an open-source design which we are releasing to the public, which is capable of walking, talking and manipulating objects.",
    tags: 'Machine Learning, Robotics, Consumer, AI',
    industries: 'Consumer, Consumer Electronics',
    batch: 'W24',
  },
  {
    name: 'Marr Labs',
    longDescription:
      'Marr Labs is making AI-voice agents that are indistinguishable from humans. Han and Dave previously created speech tech company Vlingo that powered the first Siri app and was acquired for $225M.  Now they are taking voice to the next level by making AI-voice agents that can handle virtually any phone-based job, from answering calls to schedule appointments to call center sales and support jobs—all at a fraction of the cost of a human agent.   In the US alone, businesses handle 17 billion calls a year at an average cost of $5 per call–an $85 billion addressable market. ',
    tags: 'Artificial Intelligence, Conversational AI, AI Assistant',
    industries: 'B2B',
    batch: 'W24',
  },
  {
    name: 'Forge Rewards',
    longDescription: '',
    tags: 'Artificial Intelligence, Fintech, Food Tech',
    industries: 'B2B',
    batch: 'W24',
  },
  {
    name: 'Dropback',
    longDescription:
      'Dropback is building front office software for the future of college sports. We help major athletic departments manage their teams\' "salary caps" and roster limits to construct their most competitive rosters. Just two years ago, it became legal for athletes to earn an income beyond their scholarships. Since then, despite college athletes earning $2B+, rapid regulation change has put college sports in disarray. Dropback brings order to this chaos through custom compensation frameworks, roster management, what-if playgrounds, and more--ultimately helping elite programs optimize spend & maximize talent.',
    tags: 'Sports Tech, Finance, HR Tech, Operations',
    industries: 'Fintech',
    batch: 'W24',
  },
  {
    name: 'RetailReady',
    longDescription:
      'Every time workers in a warehouse box an order, they reference a 100 page manual with instructions like where to put the shipping label. RetailReady replaces the instruction manual with a tablet application.',
    tags: 'Artificial Intelligence, B2B, Compliance, Logistics, Supply Chain',
    industries: 'B2B, Supply Chain and Logistics',
    batch: 'W24',
  },
  {
    name: 'Million',
    longDescription:
      'Million is an APM that makes websites fast, automatically. We use AI to automatically find performance issues and write code to fix them.',
    tags: 'Developer Tools, Open Source, Web Development, AI Assistant, ML',
    industries: 'B2B',
    batch: 'W24',
  },
  {
    name: 'NowHouse',
    longDescription: 'NowHouse helps stock brokerages settle trades instantly.',
    tags: 'Fintech, SaaS, Enterprise, Infrastructure, AI',
    industries: 'Fintech',
    batch: 'W24',
  },
  {
    name: 'GetCrux',
    longDescription:
      'GetCrux is the AI Creative Strategist to launch winning ads. Creatives have become the biggest lever to win on ad platforms. Yet, there is no clear way to figure out why something works. Marketers end up guessing and replicating the best performing ad, only to see it fail - with high CAC & wasted dollars. GetCrux helps performance marketers find winning patterns in their ad creatives across 100+ parameters like hooks, messaging, storyline, music, pacing, and recommend exactly what to launch next.',
    tags: 'SaaS, Analytics, Marketing, Automation, AI',
    industries: 'B2B, Analytics',
    batch: 'W24',
  },
  {
    name: 'Reprompt',
    longDescription:
      'Reprompt builds AI Agents for Location-- Mapping companies like Radar and TomTom use our agents to get live information about a point of interest or business that keeps their maps up to date.  To do this we have an internal agents platform that supports Web, Vision, Doc Reading, and soon self-driving browser agents.',
    tags: '',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'W24',
  },
  {
    name: 'InspectMind AI',
    longDescription:
      'InspectMind AI is changing the game for people who build and design buildings by making it super easy to do their paperwork. Our tool uses AI to quickly turn videos and photos from construction sites into detailed, accurate and well formatted reports. What used to take days of typing and organizing now takes just minutes. With our app, workers can spend less time at their desks and more time doing the important stuff on site.',
    tags: 'Artificial Intelligence, Construction, B2B, Proptech, AI',
    industries: 'Real Estate and Construction, Construction',
    batch: 'W24',
  },
  {
    name: 'Yarn',
    longDescription:
      'Yarn uses AI to help founders, salespeople, and marketers make product and sales videos. Teams are using Yarn to make sales collateral, launch videos, use-case demos, training guides, and feature updates for Twitter and LinkedIn. No video experience needed and everything looks great out-of-the-box – think Notion, Linear, or Stripe-quality – but branded for your team. The magic really comes from AI (TTS, CV, LLMs) – so you can zip through 5x faster than a Loom.',
    tags: 'Artificial Intelligence, B2B, Sales, Video, Marketing',
    industries: 'B2B',
    batch: 'W24',
  },
  {
    name: 'Blacksmith',
    longDescription:
      "Blacksmith helps companies run their continuous integration (CI) up to twice as fast, at half the cost. We do this by running their CI on high performance gaming CPUs. - Engineering productivity is often marred by slow CI that grows quadratically with the size of the engineering organization. - On top of this, companies pay high markups to run CI on the hyperscalers. - Consequently, companies have to run their CI on spot instances to keep costs in check. Since spot instances can get pre-empted at any point, running CI reliably on them requires [significant engineering investment](https://www.rippling.com/blog/how-rippling-used-spot-instances-to-save-and-scale-ci-cd). Blacksmith offers CI compute that is more performant, cheaper, and reliable. With Blacksmith, companies do not have to think about CI as they scale. We are starting with GitHub Actions - today's most popular and fastest-growing CI system. With a one-line change, companies can run their CI up to twice as fast on our high-performance hardware. In addition to this, Blacksmith provides colocated warm caches along with optimizations for common CI workloads (like building and pushing Docker images). Aayush, JP and Aditya have gained deep systems and product knowledge from their time at Cockroach Labs and Faire respectively. Both these companies, with several hundred engineers, were spending in the order of millions of dollars on their CI. Yet they were riddled with slow CI and actively seeking out cheaper and faster alternatives. Blacksmith offers exactly this alternative, at a time where being lean is table-stakes for most companies.",
    tags: '',
    industries: 'B2B, Infrastructure',
    batch: 'W24',
  },
  {
    name: 'CrowdVolt',
    longDescription:
      'CrowdVolt is a two-sided, bid-ask style live event marketplace similar to StockX. We’ve created the only secondary ticket exchange that supports fully automated order fulfillment. Contact us at founders@crowdvolt.com',
    tags: 'Marketplace, Entertainment, Social Network, Music, Ticketing',
    industries: 'Consumer',
    batch: 'W24',
  },
  {
    name: 'kater.ai',
    longDescription:
      "1. You explain your problem. 2. Kater identifies the most important data questions to ask. 3. Kater writes the code. 4. You get insights in seconds rather than weeks. Kater.ai flips the script on enterprise analytics by making every user an expert analyst. It uses a continuous classification engine to turn a single business question into a contextualized package of questions that is specific to your needs. Kater puts the power of data into the hands of business experts while ensuring they use trusted data that is specific to their persona. No more waiting for data analysts. No more wasted time on analysis misfires and rework. Yvonne was a data engineer and analyst who built the entire data stack at CREXi. Robin led engineering in Microsoft.   Data is the new oil. Companies are data-rich, insight-poor. We're helping companies become insight-rich. This is the future of data. ",
    tags: 'Artificial Intelligence, Analytics, Data Engineering',
    industries: 'B2B, Analytics',
    batch: 'W24',
  },
  {
    name: 'Mathos',
    longDescription:
      'Mathos AI (Formerly MathGPTPro) is the leading AI math solver that enables academic performance and productivity of both students and teachers. It has empowered over 1M students from over 200 countries in the past year, which turns the previously mission-impossible personalized learning into real. Our advanced math AI model achieves roughly 20% higher accuracy in mathematical and quantitative problem-solving capabilities then GPT4o.  As we move forward, we will tackle the hardest problems in the educational sector, personalization, adaptive learning, and shortages of teachers, with our trial runs in schools. By automating grading, providing insightful analytics, and generating adaptive assignments, our model empowers teachers to understand what their students need and what should be provided accordingly.  ',
    tags: 'AI-Enhanced Learning, Education, Generative AI, Edtech, AI',
    industries: 'Education',
    batch: 'W24',
  },
  {
    name: 'Tower',
    longDescription:
      'Tower accelerates transactional due diligence via an AI-powered, centralized diligence platform. By consolidating disparate diligence workflows, Tower helps lawyers stay organized, spot issues earlier, and close deals faster.',
    tags: 'Artificial Intelligence, Workflow Automation, Legal, LegalTech, AI Assistant',
    industries: 'B2B, Legal',
    batch: 'W24',
  },
  {
    name: 'Quivr',
    longDescription:
      'Quivr is an AI open-source platform where enterprises connect to their tools, docs, APIs and databases to chat with them.  The app can be deployed to the cloud, or self-hosted on existing infrastructure to answer any data privacy concerns. Quivr has built an open source community of 100+ contributors and has reached 31k+ Github stars! Effortlessly retrieve any available information and let Quivr generate for you new usable content.',
    tags: '',
    industries: 'B2B, Productivity',
    batch: 'W24',
  },
  {
    name: 'Dragoneye',
    longDescription:
      'Dragoneye helps devs build powerful apps and features that use images and videos. With our cutting-edge AI tech, folks can recognize things in the world with high accuracy and deep granularity - more than 13K classes - right out of the box. No more arduous process of annotating any training data or doing any machine learning work themselves. Try out our demo today at https://dashboard.dragoneye.ai/!',
    tags: 'Artificial Intelligence, Developer Tools, Computer Vision, ML',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'W24',
  },
  {
    name: 'renderlet',
    longDescription:
      'renderlet is a framework that makes it easy to develop interactive applications. Building applications with high-performance graphics is very hard – existing tools are cumbersome and aren’t truly platform agnostic, leading to frequent rework.  With renderlet, developers can write high-level code to describe 2D and 3D graphics without having to use low-level, platform-specific APIs. renderlet automatically compiles graphics code to WebAssembly and embeds a portable rendering engine inside any app, enabling graphics to safely and automatically render on any platform’s GPU. Our runtime is open-source: https://github.com/renderlet/wander',
    tags: 'Developer Tools, Design Tools, Data Visualization',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'W24',
  },
  {
    name: 'Fume',
    longDescription:
      'We are building an AI software developer that can solve complex tasks. All of those bugs, sentry errors, feature requests can now be handled by Fume now. Just report them over Slack and tag Fume under it. Fume will solve all of them in minutes. If you find yourself copying and pasting code over to ChatGPT all the time, shoot me an email at emre@fumedev.com',
    tags: 'Artificial Intelligence, Developer Tools, B2B',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'W24',
  },
  {
    name: 'The New Money Company',
    longDescription:
      "Numo is the new money company — built to be the global bank for the newly minted generation of highly ambitious digital workers in Asia, Africa, LATAM, and beyond. These contractors currently sit in the 95th percentile of earners in their country — but their financial infrastructure is unstable. It's fragmented across PEOs, gig marketplaces, and consumer remittance platforms. With their local currency weakening against the US Dollar, they need control on how and when to repatriate funds. They don't just need a remittance app. They need a bank. Numo provides international contractors with a US bank account — and instant, low-cost payment rails to move money home. This way they can hold funds in USD up to the second they need to spend it.  We help international contractors get paid like a local, while banking globally. ",
    tags: 'Fintech, Payments, Compliance, Emerging Markets, Neobank',
    industries: 'Fintech, Banking and Exchange',
    batch: 'W24',
  },
  {
    name: 'Forge',
    longDescription:
      'Forge makes procurement software for hardware companies. Trillions of dollars of purchases at the most advanced manufacturing companies are managed across spreadsheets, emails, and meetings - we automate this. Emir and Haris are brothers with backgrounds in both software and hardware engineering. While developing rocket engines, Emir saw firsthand how poor procurement operations caused weeks to months of delay, bottlenecking the pace of development. Our product lets teams collaborate with manufacturers, track orders from quote to delivery, manage purchase approvals, and more!',
    tags: 'Hardware, B2B, Supply Chain, Procurement',
    industries: 'B2B',
    batch: 'W24',
  },
  {
    name: 'Integuru',
    longDescription:
      'Integuru builds low-latency integrations with platforms lacking official APIs. We developed the first AI agent that automates the creation of permissionless integrations. Our services include authentication management, building integrations, and hosting.',
    tags: 'Developer Tools, B2B, Open Source, API, AI',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'W24',
  },
  {
    name: 'Konstructly',
    longDescription:
      "Konstructly is the first piece of software for general contractors which ties payments to work approvals. It makes it possible to accurately assess what's been built on site and how much should be paid.  Konstructly prevents overspend in construction by bridging the gap between those responsible for the payments in construction (back office) and those responsible for completing and managing the build (production).  We digitise invoicing and payment approvals and connect them to the respective quality checks of the works, trade handovers and live progress. All of which are currently managed by unlinked, separate processes and data structures.  The visibility we provide not only streamlines manual processes and allows much better schedule and payment management, it also incentivises productivity from subcontractors to ensure they get paid on time, in full. ",
    tags: 'Fintech, SaaS, Construction, B2B, Enterprise',
    industries: 'B2B',
    batch: 'W24',
  },
  {
    name: 'Pico',
    longDescription:
      "Screenshots are the fastest way to save something on your phone. Millions of people habitually screenshot things they like or might revisit - even if they never do. It's like throwing a pass to your future self that you aren't going to catch. Pico knows that your plane ticket and hotel listing are for the same trip, to grab the link for that headline so you can read it later, or to find that product online so you can buy it.",
    tags: 'Artificial Intelligence, Consumer',
    industries: 'Consumer',
    batch: 'W24',
  },
  {
    name: 'Granza Bio',
    longDescription:
      'Granza Bio is a biotechnology company developing a novel delivery "shell" platform to direct therapeutic cargo to specific tissues. Their proprietary delivery vehicles are designed using non-immunogenic proteins equipped with a targeting receptor, achieving targeted tropism to organs of interest. These vehicles offer higher stability than conventional lipid nanoparticles (LNPs) and can encompass a variety of cargo, including proteins, DNA, and RNA.   For their lead candidate, Granza Bio is leveraging the discovery of the immune system\'s powerful suite of weapons, "attack particles". Utilizing their advanced delivery platform, they aim to target these "attack particles" against a range of diseases such as cancer, autoimmune disorders, and infections.      Interested to know more? Get in touch info@granzabio.com!',
    tags: 'Synthetic Biology, Biotech, Healthcare, Therapeutics, Oncology',
    industries: 'Healthcare, Therapeutics',
    batch: 'W24',
  },
  {
    name: 'Haplotype Labs',
    longDescription:
      "We're building the HaploHub: a SaaS platform for genetic testing labs, concierge medical practices, and payer/providers to:   * predict disease risk for their patients based on proprietary or publicly available genetic models  * securely host, manage, and interrogate the genetic data of their population  * generate reports and run the most common inference algorithms (phasing, imputation, ibd, etc.) without writing code  ",
    tags: '',
    industries: 'Healthcare, Diagnostics',
    batch: 'W24',
  },
  {
    name: 'Healia',
    longDescription:
      "Healia is reinventing health insurance for dual income families. Our product enables companies to pay for the out of pocket costs of any employee that enrolls in their spouse's health insurance plan. This saves customers $10k per enrollee while providing an incredible employee perk: 100% coverage of a family's health costs. We’re now up to 50+ customers coast-to-coast with over 40k employees using our product!",
    tags: '',
    industries: 'Fintech, Insurance',
    batch: 'W24',
  },
  {
    name: 'TrueClaim',
    longDescription:
      "TrueClaim processes all payments between healthcare providers and companies that self-fund their insurance. TrueClaim's AI-enabled engine adjudicates and continuously reviews 100% of medical claims to save at least 7% of healthcare costs.",
    tags: '',
    industries: 'Healthcare',
    batch: 'W24',
  },
  {
    name: 'CoCrafter',
    longDescription:
      'CoCrafter is a construction marketplace to match contractors and subcontractors. Starting in the strong German SMB sector, CoCrafter helps contractors to find and manage local as well as foreign subcontractors.',
    tags: 'Marketplace, Construction',
    industries: 'Real Estate and Construction, Construction',
    batch: 'W24',
  },
  {
    name: 'Reform',
    longDescription:
      'Automate your repetitive tasks, interface directly with your own transport management system, and create dashboards in one single platform.',
    tags: 'SaaS, Logistics, Supply Chain, AI',
    industries: 'B2B, Supply Chain and Logistics',
    batch: 'W24',
  },
  {
    name: 'Piramidal',
    longDescription:
      'Get instant diagnosis for the vast majority of neurological conditions using our Foundational AI.',
    tags: 'Artificial Intelligence, Hard Tech, Neurotechnology, Health Tech, Diagnostics',
    industries: 'Healthcare',
    batch: 'W24',
  },
  {
    name: 'Junction Bioscience',
    longDescription:
      'Junction Bioscience is building an autonomous AI scientist to navigate the discovery of transformative medicines. Our scientific hypothesis engine iterates upon breakthrough chemistry from the laboratory to achieve clarity and control over the molecular basis of disease. We focus on the intersection of neuroinflammation and immunology where uncommon molecular insights position us to develop best-in-class therapies for millions of patients in need.',
    tags: 'AI-powered Drug Discovery, Biotech, Therapeutics, Drug discovery, AI',
    industries: 'Healthcare, Therapeutics',
    batch: 'W24',
  },
  {
    name: 'OddsView',
    longDescription:
      'OddsView is the one-stop-shop for sports betting tools and media.  The OddsView terminal allows users to browse millions of odds updated in real time to find the best bets. Users can access familiar features like positive expected value and arbitrage finders, as well as exclusive tools such as historical odds charts, all within a single platform.',
    tags: 'Sports Tech, Consumer',
    industries: 'Consumer',
    batch: 'W24',
  },
  {
    name: 'Silogy',
    longDescription:
      'Silogy is building an AI-powered platform for chip developers to simulate and debug their designs.',
    tags: 'Artificial Intelligence, Developer Tools, Semiconductors',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'W24',
  },
  {
    name: 'Senso',
    longDescription:
      "Senso is building an AI-powered knowledge base for customer support, starting in the Credit Union space.  Our product reduces contact time by over 10x by enabling support teams to make decisions about customer requests in seconds.  Bringing service automation to the financial services industry is a $6B opportunity, and we’re building for all regulated industries where Senso's founders have spent over a decade building enterprise software.  ",
    tags: 'Artificial Intelligence, Generative AI, SaaS, Enterprise Software, Conversational AI',
    industries: 'B2B, Analytics',
    batch: 'W24',
  },
  {
    name: 'Eris Biotech',
    longDescription:
      'We are developing cancer therapeutics using small molecules that inhibit immune suppression. Our drugs engage the immune system to aggressively fight tumors. In addition, our drugs have a unique delivery mechanism known as hypoxia-activated prodrugs (HAPs). HAPs are drugs designed to become active in a hypoxic (low oxygen) environment, which is a hallmark of the majority of solid tumors. By delivering active drugs only to the tumor site, we hope to overcome systemic toxicity in cancer therapeutics. Our therapeutic portfolio addresses a range of solid tumors, starting with mesothelioma. ',
    tags: 'Biotech, Therapeutics, Drug discovery, Oncology',
    industries: 'Healthcare, Therapeutics',
    batch: 'W24',
  },
  {
    name: 'Powder',
    longDescription:
      "Powder is an AI tool that helps wealth advisors rapidly create sales proposals that are personalized for each prospective client.  Using LLMs, Powder is able to automate a series of manual tasks such as understanding documents and conversations to create mind-blowing analysis that builds immediate trust. Powder has 3 main features to automate sales workflows - 1. Brokerage, tax and estate document parser thats fast and accurate. 2. Meeting notetaker thats able to capture personalized insights. 3. Portfolio analysis tool that optimizes portfolio returns, risk and fees. Our app saves hours of time and creates a pinpoint proposal that lifts a firm's ability to win new business. ",
    tags: '',
    industries: 'Fintech, Asset Management',
    batch: 'W24',
  },
  {
    name: 'OpenFoundry',
    longDescription:
      'OpenFoundry is an open source platform that helps engineers build, deploy, and scale their open source AI stack 10x faster. Ship your AI stack with just one line of code. You could think of us as an open source alternative to Hugging Face. Learn more and check out a demo of this in action in our Launch YC post: https://www.ycombinator.com/launches/KhY-openfoundry-developer-infrastructure-for-open-source-ai',
    tags: 'Developer Tools, B2B, Open Source, Infrastructure, AI',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'W24',
  },
  {
    name: 'GoldenBasis',
    longDescription:
      'GoldenBasis makes modern back-office software for brokerages like Schwab or Fidelity, and we’re starting with asset transfers. Every year, $1.1 trillion in assets are transferred between brokerages using decades-old software. Brokerages hire thousands of people to compensate but still lose revenue from abandoned transfers. We solve this problem by automating back-office workflows with AI.',
    tags: 'Fintech, API, Enterprise Software, Infrastructure, Operations',
    industries: 'Fintech, Banking and Exchange',
    batch: 'W24',
  },
  {
    name: 'Penciled',
    longDescription:
      'Penciled (W24) helps physical therapists fill 10X more canceled appointments. The core of our product is an AI agent named Nicole. Nicole helps patients join the waitlist, maintains live availabilities, and texts and calls waitlist patients to fill canceled appointments. When fully deployed, Nicole fills 79% of cancellations detected and takes an average of 3 minutes to fill an appointment. Therapists using Nicole see a 194% increase in cancellations filled.',
    tags: '',
    industries: 'Healthcare, Healthcare IT',
    batch: 'W24',
  },
  {
    name: 'Magic Hour',
    longDescription:
      'Magic Hour is a professional video creation tool.  It takes the best AI video models, puts them in one workflow, and makes creating an amazing video as easy as selecting a template and customizing it. You can use the product at https://magichour.ai',
    tags: 'Artificial Intelligence, B2B, Video, Media, Creator Economy',
    industries: 'Consumer, Content',
    batch: 'W24',
  },
  {
    name: 'Ryse',
    longDescription:
      'Ryse is the only marketplace where investors who want to buy leases can trade with real estate operators who want to sell leases.',
    tags: 'Fintech, Machine Learning, Marketplace, B2B, Proptech',
    industries: 'B2B',
    batch: 'W24',
  },
  {
    name: 'Lumona',
    longDescription:
      'Lumona is an AI-enabled search engine featuring perspectives from social media to help you understand your search results. When you’re looking to buy a new phone, instead of Googling iPhone 16 reviews and opening multiple reddit threads, blog reviews, and YouTube videos to know if you want to buy it, you can search once on Lumona to get all of that info on one page.',
    tags: 'Generative AI, Consumer, Search, AI',
    industries: 'Consumer',
    batch: 'W24',
  },
  {
    name: 'Datacurve',
    longDescription: 'We generate expert quality coding data at scale for fine-tuning LLMs ',
    tags: '',
    industries: 'B2B',
    batch: 'W24',
  },
  {
    name: 'Marblism',
    longDescription:
      "Everyone dreads the first few lines of code: choosing frameworks, designing UI/UX, setting up your project, integrating front-end with back-end… That's why we created Marblism: just describe your app, and voila!  Here’s how the magic work: 1. Describe the product you want to build: it works well for SaaS, marketplaces, social apps and AI apps 2. We generate the database and the back-end 3. We generate the front-end 4. You clone the github repos and you’re ready to go The 90% heavy lifting work is done for you. You focus on adding your 10% unique touch. You can launch your idea in days not months. ",
    tags: 'Artificial Intelligence, Developer Tools, Generative AI, AI Assistant',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'W24',
  },
  {
    name: 'CommodityAI',
    longDescription:
      'We make it easy for commodity traders manage their shipments. The largest U.S. sugar trader uses our AI-automation platform to track thousands of shipments and process over a million shipping documents.   Our team consists of an experienced commodity trader with 8 years of experience and two skilled engineers with a combined 13 years of experience from Samsara and Autodesk.',
    tags: 'B2B, Workflow Automation, Supply Chain, Enterprise Software, AI',
    industries: 'B2B, Supply Chain and Logistics',
    batch: 'W24',
  },
  {
    name: 'Veles',
    longDescription:
      'Veles – The Sales Calculator. Veles empowers sales reps to deliver pricing effectively and craft dynamic options that maximize deal size. By integrating seamlessly with CPQs And CRMs, Veles makes every sales rep a top performer.  Key Features: ✅ SaaS Pricing Calculator: Easily standardize pricing and track sales rep behavior in one intuitive platform. ✅ Standard Deal Definition: Define sales strategies and terms to expedite onboarding and maintain negotiation consistency. ✅ Performance Analytics: Gain insights into sales rep behaviors that lead to closed-won deals through comprehensive deal scoring. ✅ Alignment & Optimization: Foster team alignment by sharing negotiations and strategies for successful negotiation calls. ',
    tags: 'Artificial Intelligence, B2B, Sales, Enterprise',
    industries: 'B2B, Sales',
    batch: 'W24',
  },
  {
    name: 'Miden',
    longDescription:
      'Miden is building a modern infrastructure that facilitates the launch of card programs and various financial products for businesses in Sub-Sahran Africa. Just by reducing integration time, card fraud, improving stability, and being customer focused we quickly rose to top 5 in TPV among card issuing Fintechs in Sub-Saharan Africa within 8 months of launch. We’re going to build the first comprehensive fintech and banking software stack for Africa, based on modern technology. We’re starting with a card issuer-processor.',
    tags: 'Fintech, Payments, B2B, APIs',
    industries: 'Fintech',
    batch: 'W24',
  },
  {
    name: 'Fluently',
    longDescription:
      'Fluently is an app that helps non-native professionals improve their English with instant feedback after each Zoom call. Imagine having a personal coach, always listening and providing tips. There are 84 million non-native employees who work in English-speaking environments, and companies spend $10 billion annually solely on their English corporate training to improve communication efficiency across the company and help them grow and feel more confident. Fluently offers a more efficient and convenient way to boost speaking skills by providing feedback on pronunciation, grammar, and vocabulary after each call and fine-tuning the learning trajectory over time. That became possible by recent advancements in ML and the power of M1 chips for local processing. We are non-native founders who solve their pain, and have deep expertise in running ML on edge devices.',
    tags: 'Education, SaaS, B2B, Productivity, AI',
    industries: 'B2B, Productivity',
    batch: 'W24',
  },
  {
    name: 'Basepilot',
    longDescription:
      'Basepilot builds AI coworkers that collaborate with humans to automate work across the browser. They learn from what you do and you can teach them new skills, just by demonstration. Companies using Basepilot save 30% of their time and resources per week, freeing up time for more high-value tasks. Basepilot is founded by Ken, who previously led a fintech-product to 3M users in <12 months, and Pascal, who worked on robotics & self-driving at Carnegie Mellon and Mercedes-Benz Research. Interested to try it out? Get started here: https://www.basepilot.com/  YC Launch: https://www.ycombinator.com/launches/KcS-basepilot-your-ai-employee-to-automate-repetitive-browser-work-in-minutes',
    tags: 'Artificial Intelligence, SaaS, No-code, Automation, AI Assistant',
    industries: 'B2B, Productivity',
    batch: 'W24',
  },
  {
    name: 'Aqua Voice',
    longDescription:
      'Aqua is a voice-driven text editor. It lets you speak naturally, like to a person, and writes down what you meant in the format you want.',
    tags: 'Documents, Artificial Intelligence, Generative AI, NLP',
    industries: 'Consumer',
    batch: 'W24',
  },
  {
    name: 'xPay',
    longDescription:
      "We're building a commerce solution for SaaS companies globally that have overseas customers. We especially help them with streamlining billing operations like invoicing and reconciliation, managing foreign sales tax and accepting payments.  We abstract out the complexities of compliance, remittance and integration for these merchants by running all that machinery in the background. ",
    tags: 'Fintech, Payments, International',
    industries: 'Fintech, Payments',
    batch: 'W24',
  },
  {
    name: 'Deepnight',
    longDescription: 'DeepNight is building the next generation of night vision with AI.',
    tags: 'Artificial Intelligence, Computer Vision',
    industries: 'Government',
    batch: 'W24',
  },
  {
    name: 'Vista Power',
    longDescription:
      'Vista installs energy storage and solar at commercial and industrial properties for $0 upfront, helping businesses save up to 30% on their energy bills. The founding team previously worked at SpaceX, Rocket Lab, NASA and Firefly.',
    tags: 'Energy Storage, B2B, Sustainability, Manufacturing, Renewable Energy',
    industries: 'Industrials, Energy',
    batch: 'W24',
  },
  {
    name: 'ForEffect',
    longDescription: '',
    tags: 'Consumer, Video, Media, AI',
    industries: 'Consumer, Content',
    batch: 'W24',
  },
  {
    name: 'Ocular AI',
    longDescription:
      'Ocular AI is the data annotation engine for Generative AI, Computer Vision, and Enterprise AI models. We help you transform unstructured, multi-modal data into golden datasets to power generative AI, frontier models, and computer vision.    Ocular Foundry is the most intuitive, data-centric, and fastest platform that lets you label, annotate, version, and deploy your data for training models. It also orchestrates your annotation jobs, improving collaboration with members and annotators.    With Ocular Bolt, shift from humans in the loop to experts in the loop to supercharge your data labeling and annotation projects. Our global expert workforce ensures fast, accurate results—no matter the scale or complexity of your data.   Companies spend huge amounts on training data, but Foundry and Bolt are AI-native tools that lower costs, reduce manual effort, and accelerate high-quality data collection. We’re replacing outdated, clunky, and expensive data software!',
    tags: 'Developer Tools, Machine Learning, Computer Vision, Data Engineering, AI',
    industries: 'B2B',
    batch: 'W24',
  },
  {
    name: 'Retell AI',
    longDescription:
      'The leading platform for building and managing AI voice agents that revolutionize contact center operations.',
    tags: '',
    industries: 'B2B, Infrastructure',
    batch: 'W24',
  },
  {
    name: 'Rove',
    longDescription:
      'Rove is building the first accessible and universal airline mile, redeemable across dozens of international airlines and hotel chains worldwide.',
    tags: 'Fintech, Consumer, Travel, AI',
    industries: 'Consumer, Travel, Leisure and Tourism',
    batch: 'W24',
  },
  {
    name: 'camelAI',
    longDescription:
      'CamelAI is an AI-powered data analyst for business intelligence. Connect any data source—CSVs, CRMs, SQL databases, data warehouses—and ask Camel complex questions or request reports and charts, all without needing code or SQL.',
    tags: 'SaaS, Data Science, Data Visualization, AI',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'W24',
  },
  {
    name: 'Spark',
    longDescription:
      'Spark is an AI-powered planning and workflow tool for large-scale clean energy developers that lets them break ground faster. With Spark, developers can search across thousands of PDFs, maps, and websites to identify requirements and screen locations in seconds, not weeks. Julia and Tae were previously engineering and product managers at Brex, Tesla, and Apple. They grew up within 10 minutes of each other in Brazil but met in the US through a shared passion for software and infrastructure for society.',
    tags: 'Climate',
    industries: 'B2B',
    batch: 'W24',
  },
  {
    name: 'Downlink',
    longDescription:
      'Downlink is the turbo button for AI. With a few lines of code, Downlink improves the performance of your cloud LLMs. Our tool continuously trains expert models to handle your prompts faster than gpt-4o.',
    tags: 'Artificial Intelligence, Developer Tools, SaaS, API',
    industries: 'B2B, Infrastructure',
    batch: 'W24',
  },
  {
    name: 'Terrakotta',
    longDescription:
      'Terrakotta is a power-dialer that lets sales reps leave AI-generated voicemails.  Our first customers are Commercial Real Estate brokerages that use Terrakotta to clone their brokers voices, dial prospects and when no one answers, leave an A/B tested, personalized voicemail that gets a callback.',
    tags: 'Real Estate, Sales, Telecommunications, Home Services, Conversational AI',
    industries: 'B2B, Sales',
    batch: 'W24',
  },
  {
    name: 'Stacksync',
    longDescription:
      'Stacksync powers real-time and bidirectional data synchronization between CRMs (e.g. Salesforce, Hubspot or SAP) and databases (e.g. Postgres, Google BigQuery,...). Edits made in your CRM will instantly update in your Database, and vice-versa. To set up a sync, users simply have to connect the two chosen apps in one click and select the tables they want to sync, no-code! Stacksync reduces implementation delays from months to minutes for CRM integration projects and removes all the complexity behind CRM new feature development. We show a 90% improvement on delivery time and budget.',
    tags: '',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'W24',
  },
  {
    name: 'Hatchet',
    longDescription:
      'Hatchet abstracts away the infrastructure for managing task queues and message brokers, so you can focus on writing your background task and workflow logic. With Hatchet, you can run slow OpenAI requests in the background with async tasks, chain complex tasks together into workflows, and set retries and timeouts to recover from failure. ',
    tags: 'Developer Tools, Open Source, Infrastructure',
    industries: 'B2B, Infrastructure',
    batch: 'W24',
  },
  {
    name: 'Shepherd',
    longDescription:
      'Shepherd is a Learning assistant for schools to provide to their students. Shepherd seamlessly combines AI-enabled self-study, affordable tutoring, peer collaboration, and analytics for a personalized learning experience that is both efficient and effective. ',
    tags: 'AI-Enhanced Learning, Artificial Intelligence, Education, Generative AI, Marketplace',
    industries: 'Education',
    batch: 'W24',
  },
  {
    name: 'Sonauto',
    longDescription:
      'Sonauto is an AI music editor that turns prompts, lyrics, or melodies into full songs in any style. For example, in a few minutes with Sonauto you can make an original birthday song for your friend, sung by Frank Sinatra.',
    tags: '',
    industries: 'Consumer, Content',
    batch: 'W24',
  },
  {
    name: 'BiteSight',
    longDescription:
      "BiteSight shows users videos of food we think they will love from nearby restaurants and delivers it right to their door.  Zac and Lucious studied together at UT Austin. Zac did CS and AI Research, and Lucious built his first $1M ARR product while moonlighting at a YC startup at age 19. Since launching the beta in February, BiteSight has onboarded 274 restaurants in SF, handled 211 orders, and users are growing more than 50% each week, all organically. UberEats and DoorDash have become cluttered and impersonal super apps. They've created a $30B opportunity for a delivery app that puts the customer experience first by combining high-quality videos, recommendations, and social proof from your most trusted food critics - your friends.",
    tags: '',
    industries: 'Consumer, Social',
    batch: 'W24',
  },
  {
    name: 'Velorum Therapeutics',
    longDescription:
      'Velorum Therapeutics is developing a new class of cancer drugs that starve tumors by hijacking cancer metabolism.',
    tags: 'Biotech, Healthcare, Therapeutics, Drug discovery, Oncology',
    industries: 'Healthcare, Therapeutics',
    batch: 'W24',
  },
  {
    name: 'Zep AI',
    longDescription:
      "Build AI assistants that continually learn and delight users with personalized and accurate experiences.  ## Memory that learns from your users Zep intelligently learns from user interactions, improving your assistant or agent's knowledge over time. Recall user facts in milliseconds, with Zep adding no latency to your prompt creation. ## Ready for Production and Scale - Granular Memory Controls: Go beyond semantic search with developer-defined rubrics for user fact relevance.  - Comprehensive APIs and SDKs: Python, TypeScript, and Go SDKs, with full CRUD control of stored facts. - SOC 2 and tools for Privacy Compliance. ## Build Consistent and Correct LLM Apps Zep's Structured Output and Dialog Classification tools build on Zep's memory enabling you to build more accurate and consistent user experiences. - Extract strongly-typed data from chat history, quickly & accurately: Go beyond your LLM provider's JSON or Structured Output mode with built-in types for datetimes, floats, emails, RegEx patterns, and more. - Instantly classify conversation state: Understand user intent and emotion, segment users, and more.",
    tags: 'Developer Tools, Infrastructure, AI, Conversational AI, AI Assistant',
    industries: 'B2B',
    batch: 'W24',
  },
  {
    name: 'Openmart',
    longDescription:
      'Openmart is the GTM platform for reaching local business owners. Think of us like Apollo/ZoomInfo but for local business/POI data. We help sales professionals query millions of unstructured local business data like local government filings, websites, reviews and socials',
    tags: 'Artificial Intelligence, SaaS, B2B, Sales, AI',
    industries: 'B2B',
    batch: 'W24',
  },
  {
    name: 'Triply',
    longDescription:
      'Triply (Formerly Tripitaca) is the operating system for travel businesses in Africa. We eliminate operational chaos by unifying payments, Invoicing, payroll, accounting, operations, and more into a single platform allowing travel businesses to execute and sell more efficiently.  ',
    tags: 'Fintech, Marketplace, SaaS, Travel',
    industries: 'B2B, Operations',
    batch: 'W24',
  },
  {
    name: 'Amber AI',
    longDescription:
      'Amber is a super app for kids, offering Aristotic mentorship, social connections, browsing, and gaming. Ultra will transform screens from a source of depression and addiction, into the ultimate learning environment.',
    tags: '',
    industries: 'Education',
    batch: 'W24',
  },
  {
    name: 'Thorntale',
    longDescription:
      'Thorntale automates the creation and updating of customer review decks, enabling post-sales teams to build presentations in minutes instead of hours. Simply paste a URL into a slide to instantly create a brand-colored chart in your deck. The charts are interactive and modifiable mid-presentation, allowing you to answer customer questions on the spot and adjust charts without needing to consult the data team.',
    tags: 'SaaS, B2B, Productivity, Collaboration, Data Visualization',
    industries: 'B2B, Analytics',
    batch: 'W24',
  },
  {
    name: 'Alai',
    longDescription:
      'Alai  helps tech professionals create high quality presentations faster using AI. For example, a product manager can enter their proposal in plaintext and get polished slide options without spending hours on design.',
    tags: '',
    industries: 'B2B',
    batch: 'W24',
  },
  {
    name: 'PocketPod',
    longDescription:
      "PocketPod creates AI generated podcasts tailored to your interests. Whether it's a daily news update or a deep dive on a specific topic, we allow people to consume information in a familiar podcast format.  We will be the single place people go to consume audio entertainment, while removing nearly 100% of the cost associated with producing high quality content.",
    tags: 'AI-Enhanced Learning, Consumer, Entertainment, Podcasts, AI',
    industries: 'Consumer',
    batch: 'W24',
  },
  {
    name: 'Sample',
    longDescription:
      "Sample transforms healthcare operations from a burden into a competitive advantage.  Our users build copilots in Sample to support processes like patient intake and reimbursement. These copilots don't just speed up work – they capture valuable ground-truth data that make our models smarter over time. We work with leading national providers, already have data from 76% of US oncology clinics, and our network is rapidly expanding across the nation.",
    tags: 'Health Tech, Healthcare IT',
    industries: 'Healthcare, Healthcare IT',
    batch: 'W24',
  },
  {
    name: 'Brainbase',
    longDescription:
      'Brainbase is an AI workflow automation builder designed to handle complex enterprise workflows. Our customers use us to spin up everything from sales autopilots to full fledged customer support workflows in less than a day. SMBs and unicorns choose us over our competitors because we are the only platform that combines the power of AI with the ease and robustness of an off-the-shelf enterprise tool.',
    tags: 'Generative AI, SaaS, B2B, Workflow Automation, AI',
    industries: 'B2B',
    batch: 'W24',
  },
  {
    name: 'Focal',
    longDescription:
      'Focal is an AI video creation tool that allows anyone to create and share TV episodes and movies. We combine existing video, audio, and language models to make this process simple and straightforward. Check out our most recent demo: https://youtu.be/GFaN96OMlb0',
    tags: 'Artificial Intelligence, Consumer, Video',
    industries: 'Consumer, Content',
    batch: 'W24',
  },
  {
    name: 'Givefront',
    longDescription:
      'At Givefront (formerly Clav), we are building a banking platform tailored for nonprofits. Our unified platform allows organization leaders to manage banking, spend, payments, team turnover, reporting and compliance all in one place. ',
    tags: '',
    industries: 'Fintech, Banking and Exchange',
    batch: 'W24',
  },
  {
    name: 'Cleva',
    longDescription:
      'Cleva enables African freelancers and businesses to receive international payment for their service, while protecting themselves from local currency volatility. With a Cleva USD account, one can easily receive USD payment from anywhere in the world, spend via a card, pay bills, convert to local currency, and save in USD to hedge against local currency volatility.',
    tags: 'Fintech, B2B, Remote Work, Emerging Markets',
    industries: 'Fintech',
    batch: 'W24',
  },
  {
    name: 'Oma Care',
    longDescription:
      'We are building the technical infrastructure to train and pay the 53M family caregivers in the US. ',
    tags: 'Consumer Health Services, Health Tech, Healthcare, Health Insurance',
    industries: 'Healthcare, Healthcare Services',
    batch: 'W24',
  },
  {
    name: 'Artos',
    longDescription:
      'Artos is an AI-based document-drafting platform that helps life sciences companies turn their data into regulatory submissions in minutes. These submissions currently take months and are the final hurdle before life sciences companies are allowed to sell their product.  ',
    tags: '',
    industries: 'B2B',
    batch: 'W24',
  },
  {
    name: 'Model ML',
    longDescription:
      'Team: Chaz: Founder of Fat Llama YC S17 - Acquired by Hygglo. Responsible for Business and Sales  Arns: Founder of Fancy S20 - Acquired by Gopuff, Responsible for tech and product. ',
    tags: 'Artificial Intelligence, SaaS, Finance, B2B',
    industries: 'B2B, Finance and Accounting',
    batch: 'W24',
  },
  {
    name: 'BetterBasket',
    longDescription:
      'BetterBasket helps grocers with pricing, powered by competitive data. Our founding team worked together at Uber Eats growing the dark store business in Asia to $100 million in revenue and making it profitable, and are now building BetterBasket to bring those learnings to all grocers.',
    tags: 'B2B, Analytics, Food & Beverage, Retail, AI',
    industries: 'B2B, Analytics',
    batch: 'W24',
  },
  {
    name: 'Circleback',
    longDescription:
      "Circleback helps teams get the most out of every meeting–whether it's on Zoom, Google Meet, Slack huddles, in-person, or any other meeting platform–by writing notes and automatically taking action on details that matter most. For example, Circleback can automatically identify feature requests that come up in product demo calls and create Linear tasks for each of them, or update your CRM with customer details after a sales call. Before Circleback, Ali led the first integration of LLMs into the Stripe support product and Kevin worked on predictive analytics at Tableau as a senior software engineer.",
    tags: '',
    industries: 'B2B, Productivity',
    batch: 'W24',
  },
  {
    name: 'just words',
    longDescription:
      "AI-first marketing platform that puts companies in a state of continuous experimentation. We let you test 100+ variations within a month, across segments without the need to setup an 'octopus' on your favorite CRM tool. We also automate reporting which takes the grunt work of baby sitting every A/B test out of the way.",
    tags: '',
    industries: 'B2B, Marketing',
    batch: 'W24',
  },
  {
    name: 'Risotto',
    longDescription:
      'Want to apply AI to your IT Helpdesk queue? Risotto helps you grant software access, limit access/permission grants by time, serve knowledge, and get approvals from people like managers. All using natural language directly in chat (AKA "ChatOps") IT teams spend too much time manually provisioning software and answering the same question repeatedly. We help them improve resolution times, reduce SaaS spend, and enhance security with 24/7 automated software access and IT support. Check us out at: https://www.tryrisotto.com',
    tags: 'Artificial Intelligence, B2B, Compliance, Security, Enterprise',
    industries: 'B2B, Operations',
    batch: 'W24',
  },
  {
    name: 'DianaHR',
    longDescription:
      'DianaHR is an AI-powered HR person for the 1.4 million SMBs with at least 10 employees. Today, SMB owners spend 10+ hours a week struggling with managing software, state compliance notices, benefits questions, onboarding, insurance, workers comp, 401k, etc. With DianaHR, a human-in-the-loop AI takes care of all that and delivers peace of mind.',
    tags: 'Artificial Intelligence, Human Resources, Compliance, HR Tech, Operations',
    industries: 'B2B, Human Resources',
    batch: 'W24',
  },
  {
    name: 'HeartByte',
    longDescription:
      "HeartByte is a content platform where creators can create original fiction/comics or derivative works based on other fictional worlds. Creators write fictions 10 times faster on HeartByte. It's a place for community to fully indulge in the fictional world that they wish they were in.",
    tags: 'Generative AI, Consumer, Entertainment, Social Media',
    industries: 'Consumer, Content',
    batch: 'W24',
  },
  {
    name: 'Yondu',
    longDescription:
      "Yondu is creating the robotic workforce of the future starting with logistics automation. We're deploying humanoid robots in the first flexible, drop-in picking automation solution designed for 3PLs.",
    tags: 'Artificial Intelligence, Hard Tech, Robotics, Logistics',
    industries: 'Industrials, Manufacturing and Robotics',
    batch: 'W24',
  },
  {
    name: 'dawn',
    longDescription:
      "Make meaning out of billions of tokens. Dawn is the analytics platform for AI products. We transform user requests and model outputs into metrics you'll actually care about.",
    tags: '',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'W24',
  },
  {
    name: 'Lumina',
    longDescription:
      "AI Search Engine + API We've built search that returns 5x more relevant results compared to Google Scholar. Our search engine is free to use, and we offer an API for LLM focused applications.  Database: Over 100M research objects - covering 16 sources types, ~12.5K journals & repositories, and ~65K concepts. ",
    tags: 'Artificial Intelligence, Generative AI, API, Search, AI',
    industries: 'Consumer',
    batch: 'W24',
  },
  {
    name: 'Centauri AI',
    longDescription:
      "Centauri AI is a modern ETL and Data Science platform for banks and investment firms, starting with Structured Finance.  Financial firms heavily rely on Excel, PDF, and PPT files to exchange complex asset details, leading analysts to spend hours crunching the files and extracting insights. Moreover, these data files and reports cannot be easily reused due to poor data infrastructure.  Powered by AI, our product cuts hours of data wrangling work down to minutes and makes it possible to query past data easily. This helps firms evaluate assets faster and win more deals. Since launching last month, we've started a pilot with a brokerage team at a public investment bank that now uses our product daily. Aiming to serve over 100,000 investment teams needing complex data analysis for alternative investments, this opens up a potential $5 billion market.",
    tags: '',
    industries: 'Fintech, Asset Management',
    batch: 'W24',
  },
  {
    name: 'ProSights',
    longDescription: '',
    tags: 'Fintech, Analytics, Enterprise Software, Investments, AI',
    industries: 'B2B, Productivity',
    batch: 'W24',
  },
  {
    name: 'Manifold Freight',
    longDescription:
      "Manifold is revolutionizing the spot freight procurement process for Carriers, Brokers, and Shippers. Our inaugural product transforms the booking process for spot shipments, significantly reducing empty miles and increasing revenue.  We do this by aggregating spot shipment opportunities from a variety of shipper and brokerage sources into a single location. Andrew and Oliver bring deep domain expertise of freight from their pivotal roles at Convoy, where they were engineering leaders automating processes that were scaled to handle over 10,000 weekly shipments. This background has been instrumental in shaping Manifold's innovative approach. In just two months since launching Manifold has achieved $5,100 in monthly revenue, showcasing the pressing demand for our product. Manifold is poised to transform this $100+ billion industry. Not only will we streamline spot freight procurement operations but we will also redefine the industry's cost structure for the better.",
    tags: 'B2B, Logistics, Automation, AI',
    industries: 'B2B, Supply Chain and Logistics',
    batch: 'W24',
  },
  {
    name: 'edgetrace',
    longDescription: 'High-precision video search for mission critical applications',
    tags: 'Computer Vision, B2B, Video, API, AI',
    industries: 'B2B',
    batch: 'W24',
  },
  {
    name: 'Clarum',
    longDescription:
      "Clarum helps private equity firms conduct faster, more reliable, and cost-efficient due diligence with AI. Using Clarum, firms can upload documents from their data rooms to extract information, identify red flags and answer due diligence questionnaires. We're firm believers that technology can transform the private capital markets by providing investors with the tools needed to fully utilize the entirety of their private internal data.",
    tags: 'Artificial Intelligence, Fintech, SaaS, Finance, B2B',
    industries: 'B2B, Finance and Accounting',
    batch: 'W24',
  },
  {
    name: 'Opencall.ai',
    longDescription:
      'Opencall lets businesses answer the phone automatically. Our AIs answer questions, book appointments, and integrate with existing software. Businesses can get started with Opencall in less than an hour, no code or flowcharts required. ',
    tags: '',
    industries: 'B2B',
    batch: 'W24',
  },
  {
    name: 'Voicepanel',
    longDescription:
      'Voicepanel helps businesses gather rich feedback on their products & services with unprecedented ease. Given a simple prompt, our AI will conduct hundreds of interviews and synthesize actionable insights in minutes.',
    tags: '',
    industries: 'B2B, Analytics',
    batch: 'W24',
  },
  {
    name: 'Petra Security',
    longDescription: 'Stealth cybersecurity',
    tags: 'Cybersecurity',
    industries: 'B2B, Security',
    batch: 'W24',
  },
  {
    name: 'OffDeal',
    longDescription:
      'OffDeal is an AI-native investment bank, offering small business owners a faster, cheaper way to sell their companies at premium prices. Our AI technology automates most of the grunt work typically done by analysts at larger Wall Street banks, enabling our in-house M&A advisors to focus more on strategic client interactions, leading to better outcomes for both sellers and buyers.',
    tags: 'Artificial Intelligence, Fintech, B2B, SMB',
    industries: 'B2B',
    batch: 'W24',
  },
  {
    name: 'Delve',
    longDescription:
      "Delve is the easiest way to get HIPAA & SOC 2 compliant. We use AI to catch issues you can't and fix them before you can. Built for founders that move fast. Let's chat: https://cal.com/team/getdelve/demo",
    tags: 'Artificial Intelligence, SaaS, B2B, Compliance, Cybersecurity',
    industries: 'B2B, Security',
    batch: 'W24',
  },
  {
    name: 'Andy AI',
    longDescription:
      'Andy is AI software that completes documentation for nurses doing home visits. Our software saves $8B a year; Tiantian was previously a PM at Google’s healthcare business and Max was a staff engineer on the health team at Apple.  Andy benefits nurses and the agencies that employ them. Agencies that use Andy see up to 45% more detailed charts, 2x greater nurse productivity, and timely submission (no more billing delays!) With Andy, clinicians get their evenings back.  Home health is the fastest growing segment of healthcare, doubling to $251B by 2031. Combined with recent nursing shortages and burnout, we’re seeing not just urgency, but excitement and joy, around adopting AI for home health. ',
    tags: 'Artificial Intelligence, SaaS, Health Tech, B2B, Healthcare',
    industries: 'Healthcare, Healthcare IT',
    batch: 'W24',
  },
  {
    name: 'Hazel',
    longDescription:
      'Hazel sells AI-powered procurement software to the 19,000+ local, state, and federal government entities which procure $2.7T a year. We use AI to write solicitations 10x faster and find 10x as many vendors, saving time and money',
    tags: '',
    industries: 'Government',
    batch: 'W24',
  },
  {
    name: 'Shiboleth',
    longDescription:
      'Shiboleth automates consumer lending compliance for financial institutions using AI. Banks like Cross River Bank use us to save months of manual work by automating audits and drafting reports for the governments.  LLMs allow whole categories of manual compliance processes to be automated in ways that weren’t possible until recently. We are excited to automate back-office operations and enhance consumer protection in one of the most litigious industries.',
    tags: 'Fintech, Generative AI, B2B, Compliance, Lending',
    industries: 'B2B, Security',
    batch: 'W24',
  },
  {
    name: 'Aftercare',
    longDescription:
      'Aftercare helps you run surveys with AI-powered follow-up questions to dig into responses for deeper insights—it’s like having a skilled interviewer for every survey. ',
    tags: 'SaaS, Productivity, Feedback, Data Visualization',
    industries: 'B2B',
    batch: 'W24',
  },
  {
    name: 'Soundry AI',
    longDescription:
      "We have built a universal text-to-sound AI generator for musicians and sound designers. Music producers build songs with samples that they've hand crafted with our AI, and sound designers can incorporate generated sound effects into film, TV, and video games. With personalized generations and training data hand-picked by your favorite artists, Soundry AI is your new best friend in the music creation process.",
    tags: 'Artificial Intelligence, Social Media, Music, AI Assistant',
    industries: 'Consumer, Content',
    batch: 'W24',
  },
  {
    name: 'Elodin',
    longDescription: 'Elodin creates flight software, simulations, and hardware for drones, satellites, and defense.',
    tags: 'Hard Tech, Drones, Satellites, Rocketry, Aerospace',
    industries: 'Industrials, Aviation and Space',
    batch: 'W24',
  },
  {
    name: 'HostAI',
    longDescription:
      'We’re on a mission to streamline business communication for housing and hospitality. Our integrated AI platform helps property management and hospitality operations automate business workflows so teams can instead focus on the most human elements of their service.',
    tags: '',
    industries: 'B2B',
    batch: 'W24',
  },
  {
    name: 'Trieve',
    longDescription:
      'Infrastructure for search teams building retrieval and RAG. Trieve combines search language models with tools for tuning ranking and relevance. Building excellent search is difficult and can take months to implement then even more time to maintain. Trieve offers production-ready infrastructure that works out of the box to help search teams build adjustable AI search and RAG into their products. With tools for custom models, relevancy weighting, date-recency biasing, semantic full-text hybrid search, recommendations, and more Trieve covers the full spectrum of what a team wants from their discovery infrastructure. ',
    tags: 'Developer Tools, Open Source, API, Search, AI',
    industries: 'B2B, Infrastructure',
    batch: 'W24',
  },
  {
    name: 'Tensorfuse',
    longDescription:
      'Tensorfuse makes it easy to deploy and auto-scale AI models on your own infra using the CLI. It’s like using Modal/Replicate/Together with your cloud credits. Tensorfuse automatically scales in response to the amount of traffic your app receives. Fast cold boots with our optimized container system. Describe container images and hardware specifications in simple Python. No YAML. Behind the scenes, we manage custom k8s clusters which run the Tensorfuse Runtime.',
    tags: '',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'W24',
  },
  {
    name: 'Toma',
    longDescription:
      'At Toma, we aim to become the Microsoft/OpenAI of the Automotive industry by supplying a fully integrated AI + software suite to tens of thousands of profitable automotive dealers in America, and then worldwide. Step 1 is to provide the world’s best voice AI solution for the automotive industry, serving departments from service to sales to finance to information technology. Toma’s voice agents do thousands of AI calls every day and generate millions of dollars worth of revenue for auto dealerships. The automotive industry is a sleeping giant contributing trillions of dollars to the GDP. The industry and its processes are ready for disruption. Toma is bringing AI to all operations in the industry while working hand-in-hand with some of the biggest names such as the Car Dealership Guy, and public companies like Lithia Motors and Cox Automotive. Toma is backed best investors in Silicon Valley and the Automotive industry.',
    tags: 'Artificial Intelligence, SaaS, Operations, Automotive',
    industries: 'B2B, Operations',
    batch: 'W24',
  },
  {
    name: 'Carma',
    longDescription:
      'Carma is a B2B managed marketplace for commercial fleet owners to get same-day automotive repair for any vehicle with instant transparent offers and guaranteed pricing. Every year, fleet owners spend $573B on auto repairs globally. Fleet owners request any service through our mobile app, which we send to our network of highly-vetted partner service centers. Our partner service centers give users real-time offers on their requested services.  Our fleet customers save upwards of 50% when they use Carma vs. the median price for the same service in their zip code, while our partner service centers increase their revenues and obtain new customers. We are currently accepting commercial fleet customers: If you own multiple commercial vehicles for your business and are interested in trusted same-day turnaround for your fleet, call or text Muhammad (Carma CEO) at 636-293-5254 or email fleets@joincarma.com. If you are an owner of a highly-rated automotive service center and are interested in increasing revenue with more profitable high-ticket work, call or text Muhammad (Carma CEO) at 636-293-5254 or email shops@joincarma.com.',
    tags: 'Auto Commerce, Marketplace, B2B, Trust & Safety, Automotive',
    industries: 'B2B, Marketing',
    batch: 'W24',
  },
  {
    name: 'Preloop',
    longDescription:
      "Only 2 out of 10 ML models make it from experiment to production. Preloop helps automate the process of deployment, helping companies realize more value from their machine learning teams, while focusing teams' attention on science instead of engineering.",
    tags: 'Artificial Intelligence, Deep Learning, Developer Tools, Machine Learning, Data Science',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'W24',
  },
  {
    name: 'Superagent',
    longDescription:
      "Superagent is a workspace where AI assistants can work together, learn new information, and handle complex tasks on their own. Unlike regular AI tools that can only do basic tasks, Superagent's AI assistants can help teams with ongoing work like compliance, researching markets, and manage R&D - work that usually needs human employees.",
    tags: 'Artificial Intelligence, SaaS, AI Assistant',
    industries: 'B2B',
    batch: 'W24',
  },
  {
    name: 'Bilanc',
    longDescription:
      'An AI-Powered Engineering Management Platform. Track engineering velocity, summarise every PR and Release, and draft performance reviews & team briefings.',
    tags: 'SaaS, B2B, Analytics, DevOps',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'W24',
  },
  {
    name: 'PySpur.dev',
    longDescription: '',
    tags: 'Generative AI, Open Source, AI',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'W24',
  },
  {
    name: 'Browser Buddy',
    longDescription: 'Librarian for the Internet. ',
    tags: 'Consumer',
    industries: 'Consumer, Content',
    batch: 'W24',
  },
  {
    name: 'Astro Mechanica',
    longDescription:
      'Astro Mechanica has invented a new kind of jet engine – the Electric Adaptive Engine. Unlike any existing engine, it’s efficient at every speed. Because it’s efficient at every speed, it enables us to build a new jet aircraft with unique capabilities. It can launch payloads to orbit for 3x cheaper or fly 3x faster than regular passenger aircraft.',
    tags: 'Commercial Space Launch, Airplanes, Aerospace',
    industries: 'Industrials, Aviation and Space',
    batch: 'W24',
  },
  {
    name: 'CodeAnt AI',
    longDescription:
      'CodeAnt AI is an AI code reviewer that helps you find and fix critical code quality issues and security vulnerabilities in 30+ languages. Start your 7-day free trial today!. We are SOC 2 compliant, and are live in small teams to large unicorns.',
    tags: '',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'W24',
  },
  {
    name: 'Draftaid',
    longDescription:
      "DraftAid is the world's first generative AI for CAD manufacturing drawings, akin to GitHub Copilot but for CAD. It drastically shortens drawing creation time, turning hours into seconds. Every product that is manufactured - from construction to aerospace, automotive, durable goods, and electronics—relies on drawings. Currently, engineers and designers painstakingly make these essential drawings manually. Draftaid streamlines this process saving teams millions in time and quality.  The idea was born out of Abdullah's experience as a mechanical design team member, where he created thousands of drawings and longed for a more efficient process. Partnering with Tahsin, a neighbour with a PhD in AI, and Mohammed, a seasoned engineering VP with experience in construction software, they turned the dream into reality. Since their launch in August, DraftAid has engaged customers through targeted outreach and word-of-mouth, securing paid pilots with subsequent contracts valued at $150,000. Be a part of ushering in the new era of CAD designs!",
    tags: 'Construction, Design, Manufacturing, Architecture, AI Assistant',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'W24',
  },
  {
    name: 'Metofico',
    longDescription:
      'Metofico provides a no-code data analysis tool tailored for the life sciences. Our platform enables life scientists to analyse complex/massive datasets and extract necessary insights without needing advanced programming skills. This accessibility helps both researchers new to data science and experts save months of work. Metofico aims to be the leading centralized platform for data analysis in life science research, covering a wide range of applications from brain activity analysis (like photometry and EEG) to AI-powered detection and tracking of research animals. Our vision is to accelerate research processes and enhance the quality of research outputs across the board. By streamlining complex data analysis and making it more accessible, we’re committed to driving forward scientific discoveries and innovation. ',
    tags: 'SaaS, Data Science, No-code, Data Visualization',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'W24',
  },
  {
    name: 'Ellipsis',
    longDescription:
      "Ellipsis will help your team merge code 13% faster. Ellipsis is an AI developer tool that automatically reviews code and fixes bugs on pull requests. It uses LLM agents to catch logical errors, security issues, and can even enforce a team's style guide. The coolest part is that after Ellipsis identifies an issue, developers can tag @ellipsis-dev to have Ellipsis implement the fix. Internally, Ellipsis actually executes the code it generates, just like a human does. As a result, we allow developers to generate working, tested code directly from GitHub/GitLab. ",
    tags: 'Artificial Intelligence, Developer Tools, Generative AI, SaaS, AI',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'W24',
  },
  {
    name: 'Dime',
    longDescription:
      'Dime enables manufacturers to utilize their telemetry data to anticipate and prevent equipment and hardware product failures. Our AI agent identifies patterns of key failure modes and builds ML models to prevent them.',
    tags: 'SaaS, Manufacturing, Enterprise Software',
    industries: 'B2B',
    batch: 'W24',
  },
  {
    name: 'Lytix',
    longDescription:
      'Lytix is Datadog for LLMs. We give developers time, money and certainty when building with AI. Developers are using lytix to build custom evaluations, identify opportunities to save money, and optimize their KPIs. Our approach has helped customers reduce errors by up to 85%.',
    tags: 'Artificial Intelligence, Developer Tools, Analytics',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'W24',
  },
  {
    name: 'Pythagora (GPT Pilot)',
    longDescription:
      'Pythagora is an open source tool that builds apps from scratch by talking to users. It uses LLMs to automate developer workflows (debugging, refactoring, etc.) and ask user questions whenever it needs feedback. It is an IDE extension built on top of our open-source tool, GPT Pilot, which has over 22k Github stars. You start by describing an app you want to build; then, it asks you questions about the details of the app to write the full app specifications. Once the specs are done, it starts coding. When it finishes a task, it asks you to test the app and tell it if something is incorrect. It iterates with you by changing the code and asking you for feedback until the task is finished. Finally, it commits the code it has written and proceeds to the next task until the entire app is finished. ',
    tags: '',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'W24',
  },
  {
    name: 'Wuri',
    longDescription:
      'Wuri is an app for reading fiction stories that transforms stories into visual novels having audio, images & video. This opens a new world of storytelling for our writers and readers, who can now offer or consume stories in the format of their choice.',
    tags: '',
    industries: 'Consumer, Content',
    batch: 'W24',
  },
  {
    name: 'Open',
    longDescription:
      'Open.cx is an AI-powered, all-in-one customer support and communication platform designed for enterprises and high-growth businesses. ',
    tags: 'Artificial Intelligence, Generative AI, Conversational AI, AI Assistant',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'W24',
  },
  {
    name: 'Aedilic',
    longDescription: 'AI-assisted language learning.',
    tags: 'AI',
    industries: 'Consumer',
    batch: 'W24',
  },
  {
    name: 'Salvy',
    longDescription:
      "Salvy is a mobile carrier for businesses in Brazil. Over 300 companies use Salvy to manage over 5,000 mobile lines, cutting costs by over 50%. The founders have worked many years together in Brazil's largest fintechs (Nubank and EBANX). Today, every carrier in Brazil has roughly the same network quality - it isn't a differentiator. If you're an IT manager who needs to deploy 2k lines, you want an integrated and seamless solution. You need to deploy this resource, fast. Salvy provides a software layer that makes deploying and managing mobile lines a fast and efficient process, integrated with HRIS, ERPs, and others. This is a massive market: there are 55 million b2b mobile lines in Brazil, which adds up to 5 billion dollars in ARR in just one country. ",
    tags: 'SaaS, B2B, Latin America, Telecommunications, AI',
    industries: 'B2B, Operations',
    batch: 'W24',
  },
  {
    name: 'Centralize',
    longDescription:
      'Centralize is the AI-powered relationship intelligence platform for enterprise sales. We provide dynamic org charts that proactively identify key players, making cross-department multithreading effortless. Contact priorities update in real-time using AI-generated conversation insights from emails and calls. In-depth account planning becomes scalable and pipeline reviews now take minutes, giving the entire org a top-down view of the deal, hierarchy penetration, and the true state of conversations. The result? Deals qualified in half the time and win rates boosted by up to 56%.',
    tags: 'Artificial Intelligence, SaaS, B2B, Sales, AI',
    industries: 'B2B, Sales',
    batch: 'W24',
  },
  {
    name: 'phospho',
    longDescription:
      'phospho aims to provide sdks, tutorials and hardware kits for real-world robotics in Python. The goal is to lower the barrier for entry to robotics so that everyone can start building intelligent robots.',
    tags: 'Artificial Intelligence, Robotics',
    industries: 'B2B',
    batch: 'W24',
  },
  {
    name: 'Quantic Labs',
    longDescription:
      'Everyone hates their CRM, but why? Data entry is monotonous, distracting, and error-prone. CRMs are great in theory but are only as good as their data. Enter Quantic, Quantic takes your unstructured data (customer activities, like calls, emails, meetings, & documents) and automatically updates your CRM. Saving you time, covering your ass, and improving your data.',
    tags: 'Sales, Sales Enablement, Automation, AI, Databases',
    industries: 'B2B, Sales',
    batch: 'W24',
  },
  {
    name: 'Resonance',
    longDescription:
      'Resonance enables companies to access a set of AI marketing models trained on their proprietary data that they can rapidly deploy within their MarTech stack to optimize use cases such as email subject lines, SMS copy, etc.',
    tags: 'Reinforcement Learning, SaaS, Subscriptions, Marketing, AI',
    industries: 'B2B, Marketing',
    batch: 'W24',
  },
  {
    name: 'Firebender',
    longDescription:
      'Firebender is a free and privacy-first Android Studio AI assistant.  One-click install from the IntelliJ plugin marketplace to your IDE. It has context over your codebase and lets you use the best models for asking questions, debugging code, and generating code snippets. Unlike other AI assistants with outdated Android knowledge, Firebender continuously updates its knowledge base with the latest Android SDKs, libraries, and best practices, providing more accurate and relevant assistance for Android development.',
    tags: 'Artificial Intelligence, Developer Tools, Enterprise, AI Assistant',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'W24',
  },
  {
    name: 'Aether Energy',
    longDescription:
      'Aether is an AI-powered end-to-end platform for rooftop solar and roofing installers in the US and Western European markets.  Some of our innovations: - In-house computer vision and fine-tuned AI models built for solar - Rapid and accurate photovoltaic site design, 10x faster - Co-pilot for rooftop solar to streamline & automate various tasks for solar installers.  Why it’s needed: Today, rooftop solar is still complex, expensive, and inaccurate. More than half of the cost of a rooftop solar project comes from soft costs. We started Aether with the sole aim of reducing solar soft costs.  Our vision: Aether will be a big player in the young and emerging Solar software vertical, which has a projected 20B Global TAM up for grabs by 2025.',
    tags: 'Artificial Intelligence, SaaS, Solar Power, Climate, Renewable Energy',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'W24',
  },
  {
    name: 'Kiosk',
    longDescription:
      'At Kiosk, we help companies engage with their customers on their preferred app, WhatsApp. In short, we blend AI agents and traditional marketing tools (Campaigns, Workflows) to generate personalised conversations at scale. Think of us like the MailChimp for WhatsApp, with a conversational AI twist 💬 While WhatsApp is a key revenue driver in markets like India, its vast potential in Europe and Emerging Markets is still largely untapped!',
    tags: 'Messaging, Marketing, Automation, AI',
    industries: 'B2B, Marketing',
    batch: 'W24',
  },
  {
    name: 'Ragas',
    longDescription:
      'The fragmented and proprietary evaluation tools today are leading to significant inefficiencies and confusion among developers. The world needs a standard everyone can rely on and that is why we are building Ragas as the open-source standard.  We have 4k stars on GitHub, 1.3k members in our discord community, and over 80+ external contributors. We also have partnerships with key AI companies like Langchain, Llamaindex, Arize, Weaviate and more to help create a standard. We already process 5 million evaluations monthly for engineers from companies like AWS, Microsoft, Databricks, and Moody’s and it is growing at 70% month over month. We are building LLM application testing and evaluation infrastructure for Enterprises. ',
    tags: 'Artificial Intelligence, Developer Tools, Open Source',
    industries: 'B2B, Infrastructure',
    batch: 'W24',
  },
  {
    name: 'sync.',
    longDescription:
      "at sync. we're making video as fluid and editable as a word document how much time would you save if you could *record every video in a single take?* no more re-recording yourself because you didn't like what you said, or how you said it. just shoot once, revise yourself to do exactly what you want, and post. that's all. this is the future of video: *AI modified >> AI generated* we're playing at the edge of science + fiction. our team is young, hungry, uniquely experienced, and advised by some of the greatest research minds + startup operators in the world. we're driven to solve impossible problems, impossibly fast. our founders are the original team behind the open sourced wav2lip — the most prolific lip-sync model to date w/ over 10k+ GitHub stars. we  [1] train state-of-the-art generative models,  [2] productize + host them for scale [3] grow virally through content [4] upsell into enterprise",
    tags: '',
    industries: 'B2B',
    batch: 'W24',
  },
  {
    name: 'PandasAI',
    longDescription:
      'PandasAI is an open-source library for conversational data analysis. Enterprises can connect their dataframes, databases or datalakes and do data analysis in plain english. For example, PandasAI can be used by everyone in the company to visualize data or to ask complex queries and extract valuable insights for better data-informed decisions.',
    tags: 'Artificial Intelligence, Analytics, Data Visualization, AI',
    industries: 'B2B, Analytics',
    batch: 'W24',
  },
  {
    name: 'Infinity',
    longDescription:
      'Infinity is a banking and payments platform for cross-border businesses in India. We help our customers make cross-border payments that are 70% cheaper than traditional methods and earn income on idle cash by investing in government securities.',
    tags: 'Fintech, Payments, B2B, Investing, International',
    industries: 'Fintech, Payments',
    batch: 'W24',
  },
  {
    name: 'InQuery',
    longDescription:
      "InQuery is an operating system for the insurance industry built from the ground-up to leverage modern language processing techniques to improve claims handling, policy administration and distribution, and underwriting, starting with the world's first AI-native Claims Management System. Our mission is to empower the insurance industry to close the trillion dollar underinsurance gap by expanding the reach and scope of insurance products to cover the emerging risks of the 21st century.",
    tags: 'Documents, Insurance, AI, AI Assistant',
    industries: 'Fintech, Insurance',
    batch: 'W24',
  },
  {
    name: 'Markprompt',
    longDescription:
      'Close customer support tickets faster with AI. We’re building AI infrastructure to power customer support at scale. With Markprompt, companies can automate customer support, scale without increasing headcount, and deliver exceptional user experiences.   Scaling customer support with headcount is expensive, with human resources accounting for 90%+ of customer support expenses. On top of that, customer support agents often burn out leading to turnover and reduced quality. As companies grow, so does their expert knowledge, which is hard to access at scale and makes keeping employees up-to-date nearly impossible. Markprompt addresses the root of the information access problem by indexing all available knowledge within a company, setting the foundation for a robust system of record to feed the AI. Built from the ground up with an API-first approach, Markprompt provides SDKs (such as React hooks and components) and no-code tools to enable integrations at all touchpoints in the customer journey.',
    tags: 'Artificial Intelligence, Developer Tools, Customer Support, Infrastructure, AI Assistant',
    industries: 'B2B, Infrastructure',
    batch: 'W24',
  },
  {
    name: 'Tamarind Bio',
    longDescription:
      'Tamarind Bio is a website and API which allows scientists to use computational biology tools at scale using a simple interface. On Tamarind, scientists can use ML models like AlphaFold to design and simulate molecules by simply selecting inputs instead of or setting up a high performance computing environment or dealing with DevOps. Our tools are used by thousands researchers in large pharma companies, top biotechs, and academic institutions. We currently focus on models in protein design and engineering, including for antibodies/therapeutics and enzymes. Get in touch at founders@tamarind.bio',
    tags: 'AI-powered Drug Discovery, Artificial Intelligence, SaaS, B2B, Biotech',
    industries: 'B2B',
    batch: 'W24',
  },
  {
    name: 'Clarion',
    longDescription:
      "We're on a mission to make healthcare more accessible and human with voice AI technology. Our platform enables healthcare organizations and their staff to automate phone-based workflows typically handled by humans. We partner with health care organizations to reduce their operational expense and eliminate administrative burden. Our founders bring a blend of clinical experience and technical expertise. Ryan is a Stanford/Harvard trained physician formerly on the founding team of Two Chairs and Ophelia (W20). Jeff formerly worked on voice AI at Amazon Alexa and ML projects at Citi/Salesforce. We have incredible traction and a healthy pipeline of health systems to grow into. We are well funded and backed by top investors, including Y Combinator.",
    tags: 'Artificial Intelligence, Health Tech, Digital Health, Healthcare',
    industries: 'Healthcare',
    batch: 'W24',
  },
  {
    name: 'Swift',
    longDescription:
      'Swift is building instant international payments to replace the archaic correspondent banking infrastructure. Our first product is an all-in-one embedded finance platform for online merchants.',
    tags: 'Fintech, Payments',
    industries: 'Fintech, Payments',
    batch: 'W24',
  },
  {
    name: 'Intercept',
    longDescription:
      'Intercept lets CPG brands challenge incorrect charges from retail chains. It ingests all of a brand’s fees across their retailer portals and emails, flags the fees that can be disputed, and automates away the mundane tasks involved in fee disputes. What previously took a team of people is now manageable by a single person.',
    tags: '',
    industries: 'B2B, Retail',
    batch: 'W24',
  },
  {
    name: 'Toolify',
    longDescription:
      'Toolify is dev-first internal tooling. At some point, companies using low-code builders hit a brick wall, and are bogged down by their limitations rather quickly. We offer: - A starter kit with sensible defaults, - A VSCode extension which has AI that creates the internal tool for you, end to end, and, - A web app where you can deploy your tools. This gives you the best of both worlds -- everything you need to build tools just as fast as low-code, and an escape hatch when you need it.',
    tags: 'Artificial Intelligence, Developer Tools, B2B',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'W24',
  },
  {
    name: 'Decipher AI',
    longDescription:
      'Decipher AI builds AI agents that analyze session replays to understand user behavior, detect bugs and reveal insights—helping teams fix what matters, improve products, and keep their customers happy.',
    tags: 'Artificial Intelligence, Developer Tools, B2B, Analytics, Enterprise Software',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'W24',
  },
  {
    name: 'Infinity AI',
    longDescription:
      'Infinity is a script-to-movie foundation model. Creators provide a script describing the actions and dialogue of their characters and get back a video with highly expressive virtual actors. Our first product allows people to generate talking head videos with AI. ',
    tags: 'Artificial Intelligence, Video, Creator Economy',
    industries: 'Consumer, Content',
    batch: 'W24',
  },
  {
    name: 'Double',
    longDescription:
      'Double lets anyone design and invest in their own stock index that’s advised, managed and tax optimized by Double.  ',
    tags: 'Fintech, Finance, Investing, Consumer Finance, Stocks',
    industries: 'Fintech, Asset Management',
    batch: 'W24',
  },
  {
    name: 'Speck',
    longDescription:
      "We're the makers of Paige. Paige is an AI frontend engineer that helps developers iterate faster on websites. Our customers use us to save hours on slow frontend development. Lucas built Sweep, an AI developer. Raghav won 9 hackathons with LLM agents. ‎ Join our community: https://discord.gg/speck",
    tags: 'Artificial Intelligence, Developer Tools, B2B, Web Development, AI',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'W24',
  },
  {
    name: 'Guide Labs',
    longDescription:
      'At Guide labs, we build Interpretable foundation models and AI systems that can reliably explain their reasoning, and are easy to audit, steer and understand. We provide access to these models via our API. ',
    tags: '',
    industries: 'B2B',
    batch: 'W24',
  },
  {
    name: 'OmniAI',
    longDescription:
      "Omni turns documents, slide decks, websites and more into the data you need. You'll never need to copy + paste data into spreadsheets again. - Connect to a database or document store. We support Snowflake, Postgres, Google Drive, S3 and more. - Transform your data - Define type safe schemas to run against your unstructured data. We’ll run those models against your data, and keep your warehouse in sync as new rows/fields are added/deleted. - Query with SQL - All the transformed data stays in your warehouse. Surface this data in your product, or analyze with your existing BI tools.",
    tags: 'Documents, Artificial Intelligence, Finance, Automation',
    industries: 'B2B, Operations',
    batch: 'W24',
  },
  {
    name: 'Keywords AI',
    longDescription:
      "The only platform you need to launch and optimize your LLM application.  We built a unified interface for any model with built-in infrastructure, so you can focus on building a product people love. Integration is dead simple - everything comes with 2 lines of code: - Playground and prompt management for testing models and improving prompts - Beautiful pre-built dashboards to monitor every LLM metric and user log - Production performance monitoring with auto-evaluations ... and a lot more! Reach out to team@keywordsai.co if you have any questions. Excited to see what you'll build with us!",
    tags: 'Developer Tools, SaaS, B2B, API, AI',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'W24',
  },
  {
    name: 'PromptArmor',
    longDescription: '',
    tags: 'Artificial Intelligence, Generative AI, Security, Cybersecurity',
    industries: 'B2B, Security',
    batch: 'W24',
  },
  {
    name: 'Zaymo',
    longDescription:
      "Recent changes in email clients made it possible to embed a whole website inside an email.  We've built the first email builder that lets Shopify brands create emails that are fully interactive like websites.  Zaymo emails decrease friction and increase conversion for product marketing and data collection. ",
    tags: '',
    industries: 'B2B, Marketing',
    batch: 'W24',
  },
  {
    name: 'Glimmer',
    longDescription:
      "Glimmer is a new way to search massive PDFs using AI. If you've ever dealt with massive PDFs (i.e. over 1,000 pages), you know how broken search can be. You have no choice but to use “Cmd-F” and manually sift through thousands of search results to find specific information. Professionals in construction, law, finance, and healthcare spend hours doing this every day. Glimmer makes searching these large documents 10x easier.  When you upload a PDF, Glimmer uses AI to intelligently index your documents. You can then search your PDF in natural language and get answers with verifiable page sources. You can get started with Glimmer for free with any kind of PDF at withglimmer.com. ",
    tags: 'Search, AI',
    industries: 'B2B',
    batch: 'W24',
  },
  {
    name: 'Meticulate',
    longDescription:
      'Meticulate is the best tool for discovering and qualifying companies. We help sales and investment teams target highly specific ICPs and rapidly test outbound strategies.',
    tags: 'Generative AI, Finance, Sales, Investing, AI',
    industries: 'B2B',
    batch: 'W24',
  },
  {
    name: 'CloudCruise',
    longDescription:
      'CloudCruise lets you trigger user-permissioned workflows in any SaaS software. We do this by providing a simple and well-documented development environment, as well as authentication and browser infrastructure. ',
    tags: 'Generative AI, SaaS, Workflow Automation',
    industries: 'B2B',
    batch: 'W24',
  },
  {
    name: 'Attunement',
    longDescription: 'Attunement an automation workflow platform for psychiatric assessments.',
    tags: 'Artificial Intelligence, Workflow Automation, Healthcare',
    industries: 'Healthcare',
    batch: 'W24',
  },
  {
    name: 'Lucite',
    longDescription:
      'Lucite is building the first AI-native platform to help insurance brokers and advisors automate the most complex and time consuming parts of their job. We ingest unstructured carrier documents to accurately extract and analyze data, create insights, and generate deliverables, saving firms hours of time each day.',
    tags: '',
    industries: 'B2B',
    batch: 'W24',
  },
  {
    name: 'Selera Medical',
    longDescription:
      "Heart failure impacts millions worldwide and is associated with poor quality of life and high mortality rates. Because the heart cannot pump efficiently, fluids buildup around the body. Fluid overload is the main driver behind patient symptoms (shortness of breath, fatigue, chest pain, etc.) and hospitalizations. Our minimally invasive device leverages the body's innate fluid management system to offload trapped fluid and prevent subsequent rounds of buildup. The one-time procedure has sustained effect -- keeping patients healthier, happier, and out of the hospital.",
    tags: 'Medical Devices, Healthcare',
    industries: 'Healthcare, Medical Devices',
    batch: 'W24',
  },
  {
    name: 'OneGrep',
    longDescription:
      'OneGrep is a DevOps Agent that helps engineers automate manual devops tasks. It works across integrations that teams have to search, correlate, and operate automated tasks like runbook automation during incidents. OneGrep specializes across devops tools to help teams release code faster and more reliably so that engineers can spend more time building rather than being trained in bespoke tools like Observability, Ci/Cd, or Infra.      Achintya and Brian are technical co-founders who have deep domain expertise in building and operating systems at scale at Coinbase, Disney, and Amazon. Achintya led the Search Team at Disney enabling DisneyPlus to scale to 70M users in two weeks. Brian was a founding engineer on the team that built the Incident Management Platform at Amazon that helps 30k DAUs in Amazon resolve critical incidents every day.      https://www.onegrep.dev',
    tags: 'Generative AI, B2B, DevOps, Conversational AI',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'W24',
  },
  {
    name: 'Engines',
    longDescription:
      'Engines is the best platform for AI software engineering agents. AI SWEs will become a fundamental part of every engineering organization. We are building the foundational building blocks to make that a reality.',
    tags: 'Artificial Intelligence, Developer Tools, DevOps, Infrastructure',
    industries: 'B2B, Recruiting and Talent',
    batch: 'W24',
  },
  {
    name: 'Tusk',
    longDescription:
      'Tusk is an AI agent that helps developers generate unit and integration tests with codebase context. Tusk runs on your PRs as a non-blocking check and suggests happy path and edge case tests that are not covered by existing tests. Engineering teams use Tusk to merge PRs 25% faster with increased feature coverage.',
    tags: 'Artificial Intelligence, Developer Tools, SaaS, B2B, AI',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'W24',
  },
  {
    name: 'PartnerHQ',
    longDescription:
      'PartnerHQ is building the next generation LinkedIn. We are creating the world’s most valuable and accurate professional network graph by capturing and indexing vast quantities of relationship signals.  Individuals use PartnerHQ to grow and monetize their networks. B2B companies use PartnerHQ to buy warm intros and drive high-value sales.  PartnerHQ was created during Y Combinator’s W24 cohort and launched in February of 2024. Since launch we have signed on hundreds of paying companies, domestic and international. 97% of all users have come inbound or word-of-mouth. ',
    tags: '',
    industries: 'B2B, Sales',
    batch: 'W24',
  },
  {
    name: 'atopile',
    longDescription:
      'atopile is a new language to design electronic circuit boards with code. We replace point and click graphical interfaces with code to bring software level automation and reuse to the field of hardware design. Our project is open source on GitHub! https://github.com/atopile/atopile',
    tags: 'Hardware, SaaS, Design Tools, Electronics',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'W24',
  },
  {
    name: 'Copper Health',
    longDescription: 'All-in-one RTM platform designed for physical therapy and powered by AI',
    tags: 'Health Tech, Telehealth, B2B, Digital Health, AI',
    industries: 'Healthcare, Healthcare IT',
    batch: 'W24',
  },
  {
    name: 'SynsoryBio',
    longDescription:
      'SynsoryBio is creating next generation, protein therapeutics that sense where they are in the body and only activate at diseased tissue. This technology platform has the potential to expand the therapeutic window of highly potent drugs and apply to many diseases such as cancer and autoimmune disorders.',
    tags: 'Synthetic Biology, Biotech, Therapeutics, Oncology',
    industries: 'Healthcare, Therapeutics',
    batch: 'W24',
  },
  {
    name: 'Yoneda Labs',
    longDescription:
      'Yoneda Labs provides software to help chemists optimise reactions. When chemists make a drug or a material, we help them figure out the best reaction parameters such as temperature, concentration and catalyst. When Jan was working at chemical labs, he experienced the struggle of spending weeks guessing reaction conditions. We then started experimenting with ML to speed up the process. Now, as a team of three friends from the University of Cambridge, we’ve spent the last month combining our domain expertise in Computer Science, Machine Learning and Chemistry to develop state of the art models for reaction optimisation. Although ML is becoming well established in other fields, current chemical models generalise poorly and require lots of programming experience. We make our models easily accessible to chemists in the lab. Finding the right conditions quickly allows pharmaceutical companies to test more drugs, and finding better optima makes manufacturing process cheaper and more environmentally friendly.',
    tags: '',
    industries: 'B2B',
    batch: 'W24',
  },
  {
    name: 'TokenOwl',
    longDescription:
      'TokenOwl aggregates crypto and other financial accounts in one place with trustless AI. It lets highly active traders calculate taxes with greater accuracy and generate AI powered insights about their portfolio. Users can execute trades with prompts, build custom dashboards, and query their logs in natural language. Low fee networks like Solana have brought a new generation of traders with thousands of transactions, and TokenOwl saves them hours of time and unlocks analytics that lead to higher profitability. ',
    tags: 'Crypto / Web3, AI, Cryptocurrency',
    industries: 'Fintech',
    batch: 'W24',
  },
  {
    name: 'Verse Therapy',
    longDescription:
      "At Verse Therapy, we're dedicated to making quality speech therapy accessible for everyone by empowering speech-language pathologists (SLPs) to launch and grow their own independent practices. We help therapists focus on what they do best—providing compassionate, personalized care—by taking care of the administrative tasks that often lead to burnout. Through thoughtful marketing and partnerships with care organizations like rehab centers, we connect SLPs with individuals who need their expertise. Our AI-enabled back office streamlines insurance processing, scheduling, and documentation, reducing non-therapy overhead. We're now live in 10 states with over 35 dedicated therapists and are in-network with leading insurance providers, making it easier for clients to receive the support they need.",
    tags: 'Consumer Health Services, Digital Health',
    industries: 'Healthcare, Healthcare IT',
    batch: 'W24',
  },
  {
    name: 'Topo',
    longDescription:
      "We are helping B2B companies reach the right leads with an AI sales agent custom trained on their knowledge. The goal is to reproduce the behavior of a sales top performers: - They know the product, the industry, the pain points, and the company's value proposition perfectly (trained on datas from your knowledge base, calls transcript, CRM...).  - They will find the right leads, ready to buy, based on buying signals in the industry-specific channels (Linkedin, G2, Github...) or on the company's website visitors. That's exactly what the agent can do! Think of it as an expert SDR in your industry, ramp up in minutes. ",
    tags: 'SaaS, Sales, AI',
    industries: 'B2B, Sales',
    batch: 'W24',
  },
  {
    name: 'Trellis',
    longDescription:
      'Trellis converts your unstructured data into SQL-compliant tables with a schema you define in natural language. With Trellis, you can now run SQL queries on complex data sources like financial documents, contracts, and emails. Our AI engine guarantees accurate schema and results. Leading enterprises use Trellis to: 1. Unlock hidden revenue in their customer data (e.g., Underwriting teams use Trellis to extract key features from transaction data and build better risk models.) 2. Supercharge RAG applications by enabling end-users to ask analytical questions not possible before with traditional Vector DB (e.g., what are the top three features that users are requesting) 3. Enrich their data warehouse with business-critical information (e.g., Retrieving detailed pricing and quantity information of products sold on competitor websites)',
    tags: 'Artificial Intelligence, B2B, Data Engineering, Infrastructure, Databases',
    industries: 'B2B',
    batch: 'W24',
  },
  {
    name: 'Ecliptor',
    longDescription: '',
    tags: 'Artificial Intelligence, B2B, Sales',
    industries: 'B2B, Sales',
    batch: 'W24',
  },
  {
    name: 'Greenboard',
    longDescription:
      "Greenboard is building a singular, AI-powered platform to handle management of the entirety of financial firms’ compliance programs, and eventually all back office processes. Today, financial institutions use Greenboard to detect risk using AI and to rip out and replace the bad legacy back office tooling they have wanted to get rid of for years.   Greenboard's mission is to enable financial institutions to operate their back office teams at a higher standard, with half of the headcount. We’re starting with compliance",
    tags: '',
    industries: 'Fintech',
    batch: 'W24',
  },
  {
    name: 'Eggnog',
    longDescription:
      'Eggnog is the Youtube for AI-generated content. The initial product is the only AI video platform on the market that generates consistent characters. The vision is to have the largest library of remixable characters and sets for users to collaboratively build and watch AI-generated content. Eggnog launched a week ago, and videos made on the platform are getting 100k views on Twitter. Team: Sam (BS, Applied Math from Harvard) was a data scientist at Facebook and Quora working on newsfeed and creator monetization. Jitesh (BS, MEng from MIT CS) was a consultant at McKinsey and PM at Flexport.  ',
    tags: 'Artificial Intelligence, Entertainment, Social Media, Video',
    industries: 'Consumer',
    batch: 'W24',
  },
  {
    name: 'Artisan',
    longDescription:
      "At Artisan, we're creating AI Employees, called Artisans, and software which is beautiful, easy to use, and replaces the endless stack of point solutions. We're starting with outbound sales. Our platform contains every tool needed for outbound sales - B2B data, AI email sequences, deliverability optimization tools and so much more.  Ava, our AI BDR, operates within our platform. She automates: - Lead discovery with access to over 300M B2B contacts - Lead research, with 10s of data sources - Choosing a sales strategy and writing + sending hyper-personalized emails - Managing deliverability with a suite of tools - from email warmup to placement tests We're on a mission to create the final boss of software, with every SaaS product needed for sales and AI employees consolidated together in one exceptional platform.  This is the next Industrial Revolution.",
    tags: 'B2B, Sales, Automation, AI, AI Assistant',
    industries: 'B2B',
    batch: 'W24',
  },
  {
    name: 'Octolane AI',
    longDescription:
      'Building AI-first Salesforce. Our CRM does a lot more than just storing customer data. It uses AI to find the best customers, reach out to them and close them.',
    tags: '',
    industries: 'B2B, Sales',
    batch: 'W24',
  },
  {
    name: 'SuretyNow',
    longDescription:
      'Surety bonds are financial guarantees that businesses must purchase to comply with government regulations. For example, all contractors must have a surety bond to bid and work on federal construction projects. It is a $8b opportunity in the US.  SuretyNow is building the surety bond platform for the 21st century. Businesses can apply for bonds and receive affordable quotes online in minutes. We offer the fastest and simplest online experience for getting surety bonds.',
    tags: 'Fintech, B2B, Insurance',
    industries: 'Fintech, Insurance',
    batch: 'W24',
  },
  {
    name: 'Roe AI',
    longDescription:
      "Roe AI is the next-generation AI-powered data warehouse to store, process, and query unstructured data like documents, websites, images, videos, and audio. By making the impossible data possible, we help data teams become strategic enablers. Data lies at the heart of strategic decision-making, steering enterprises toward their KPIs. Roe AI accelerates these successes by providing intuitive and intelligent multi-modal data extraction, data classification & multi-modal RAG via Roe's SQL engine. Book us a call to discover how Roe AI can take your enterprise's data intelligence to the next level https://cal.com/team/roe-ai/hi-roe The future of data science is here.",
    tags: 'Generative AI, SaaS, B2B, Big Data, Infrastructure',
    industries: 'B2B, Infrastructure',
    batch: 'W24',
  },
  {
    name: 'FurtherAI',
    longDescription:
      'FurtherAI is building a workforce of AI Teammates for the insurance industry to handle repetitive manual tasks involving unstructured data processing and data entry across disjointed systems. Our first AI Teammate handles quote generation workflows for insurance brokers & MGAs. ',
    tags: '',
    industries: 'B2B',
    batch: 'W24',
  },
  {
    name: 'Arini',
    longDescription:
      'Arini is the AI receptionist for dentists that answers phone calls, and schedules appointments. Most dental appointments are scheduled over the phone by overworked receptionists who put patients on hold and miss a third of incoming calls. This costs clinics a 15% loss in revenue. Private equity investment fueled large dental groups to acquire thousands of clinics in the past few years. We are selling to these groups, since their clinics have a standardized tech stack. They’re also growing really fast - in just two years they will make up 40% of the US dental market. Dental is just the beginning.',
    tags: 'Artificial Intelligence, Health Tech, Dental, Call Center, AI',
    industries: 'Healthcare, Healthcare IT',
    batch: 'W24',
  },
  {
    name: 'Paradigm',
    longDescription:
      'Centered around the primitive of a spreadsheet, Paradigm puts swarms of intelligent agents at your fingertips. The real power of Paradigm comes with scale: imagine having tens of thousands of interns working for you in parallel. Paradigm is 1000x faster than manual data collection, completing an average of 500 cells per minute. Join our waitlist www.paradigmai.com/join ',
    tags: 'Artificial Intelligence',
    industries: 'B2B',
    batch: 'W24',
  },
  {
    name: 'PointOne',
    longDescription:
      'Lawyers have to manually track all their client work in 6-minute increments. PointOne uses AI to completely automate time tracking and bill review, helping law firms collect more revenue and saving lawyers hours each week.',
    tags: '',
    industries: 'B2B, Legal',
    batch: 'W24',
  },
  {
    name: 'Starlight Charging',
    longDescription:
      "Starlight Charging offers ultra-low-cost EV-charging to condos and apartments. Our power-balancing software enables our network of installers to install chargers without expensive infrastructure upgrades, cutting the cost by 10x compared to any other option. Through Starlight's Partner Program, electricians and small business owners can create their own charging network and generate passive income with owner-operated charging stations using Starlight battle-tested software.",
    tags: 'Proptech, Climate, Energy, Electric Vehicles, Automotive',
    industries: 'Industrials, Energy',
    batch: 'W24',
  },
  {
    name: 'Assembly',
    longDescription:
      'Assembly is a customer experience platform that turns customer feedback into product growth and support requests into long-lasting relationships. ',
    tags: 'B2B, Productivity, Customer Success, Customer Support',
    industries: 'B2B, Operations',
    batch: 'W24',
  },
  {
    name: 'MathDash',
    longDescription:
      "MathDash is an online live math-competition platform that gets students addicted to learning. Our target audience already spends thousands of hours doing math questions competitively, and we've *already* gotten the best of the best to switch to doing problems on our site - an average of 65 minutes a day among our 200 most active users, and a total of over 150,000 arithmetic questions solved in just the last week! Why? Because it is more thrilling and exciting to compete live, see yourself on a leaderboard, and improve your 'ELO' rating.  We are USA Math Olympians, and have been the top power users on every single product marketed towards competitive math learners. What's missing is the math game that allows anyone at any level to play with math on demand and compete live at their level, whether it's in the back of an Uber or while training for a math competition.",
    tags: '',
    industries: 'Education',
    batch: 'W24',
  },
  {
    name: 'Leaping',
    longDescription:
      'When bad software gets shipped, software companies burn a lot of money and customer trust fixing it. Most software engineers will tell you they spend more time fixing code than writing it, which will only become more true as AI code assistants gain adoption. Leaping autonomously root causes bugs and generates tested code fixes.',
    tags: 'Developer Tools, AI Assistant',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'W24',
  },
  {
    name: 'Basalt',
    longDescription:
      "Basalt Tech is a spacecraft OS company based in San Francisco. We're building Dispatch: An OS which allows different types of satellites to work together, and produces optimized instructions for fleets of spacecraft. The company is founded by Max Bhatti and Alex Choi, lead engineers at the MIT CubeSat program. Previously, the duo worked as systems engineers at SpaceX, and the UK Ministry of Defense. Basalt Tech recently received its seed investment as part of the Y Combinator W24 batch, and is currently in technical development.",
    tags: 'Aerospace, Enterprise Software, Automation',
    industries: 'Industrials, Aviation and Space',
    batch: 'W24',
  },
  {
    name: 'Carousel Technologies',
    longDescription:
      "We help investment bankers & consultants prepare materials faster & with fewer errors. Carousel is a PowerPoint plugin carrying a suite of tools designed to help junior professionals save time while putting together decks.  Our first tool brought a supercharged version of Word's \"Track Changes\" to PowerPoint so deal teams could quickly review each other's work, speeding up the feedback loop of giving and turning comments by 10x. Our second tool uses computer vision to populate charts and tables in PowerPoint based on Excel data, as well as extract table data from PDFs into Excel with two clicks. We've got many more features on the way that build out a complete toolbelt, including an AI copilot for PowerPoint that can handle complex, multi-step tasks, outperforming Microsoft's native copilot.",
    tags: 'Finance, B2B, Enterprise Software',
    industries: 'B2B, Finance and Accounting',
    batch: 'W24',
  },
  {
    name: 'Agentic Labs',
    longDescription:
      'Agentic Labs is making software design and architecture less painful by building AI into the process. Today, developers have no shortage of tools for instantly creating chunks of code, but designing the systems that integrate this code is the hardest and most manual part of software engineering. Our first product is Glide, an AI-first editor purpose-built for writing technical design docs. It connects to your codebase and saves your engineering team time on triage, planning, and implementation of complex code changes.',
    tags: 'Artificial Intelligence, Developer Tools',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'W24',
  },
  {
    name: 'Fractal Labs',
    longDescription:
      "Making a game engine that can code itself at runtime to adapt to player actions. Check out the first application of our engine, Wizard Cats (https://store.steampowered.com/app/3176500/Wizard_Cats/), with all game mechanics being generated at runtime (https://www.reddit.com/r/LocalLLaMA/comments/1el1et6/were_making_a_game_where_llms_power_spell_and/). We are three friends who met in undergrad at Princeton. The team has published multiple papers at Neurips on LLM's, developed HFT options trading algorithms, and created robust large scale server infrastructure.",
    tags: 'Consumer, Gaming, Social, AI',
    industries: 'Consumer, Gaming',
    batch: 'W24',
  },
  {
    name: 'Pivot Robotics',
    longDescription:
      'Pivot Robotics makes AI software for robotic arms that helps manufacturers automate their most labor intensive tasks. We are starting out with the dangerous task of metal grinding and are currently deploying our software on 10+ robots in a cast-iron foundry. ',
    tags: 'Artificial Intelligence, Robotics, Industrial',
    industries: 'Industrials, Manufacturing and Robotics',
    batch: 'W24',
  },
  {
    name: 'Aidy',
    longDescription:
      'Aidy delivers persistent, in-depth research for organizations that rely on accurate and timely insights to make critical decisions. New cycles move fast and and information is scattered—especially on topics that rarely make headlines—but Aidy cuts through the noise. Our AI analysts combine real-time monitoring with rigorous analysis to help market research firms, asset managers, trade associations, and public affairs agencies sharpen their information edge. By transforming complex information into actionable intelligence, Aidy empowers organizations to identify emerging trends, reduce risk, and make better decisions faster. In our previous research-centric roles at The Rockefeller Foundation, U.S. Senate, and biotech startups, we saw how difficult it is to stay on top of new developments in niche areas. We found ourselves researching the same topics again and again to write memos or briefings that would steer significant organizational resources. Pretty quickly, we realized AI can now handle most of this process end-to-end. From there, Aidy was born!',
    tags: '',
    industries: 'B2B, Operations',
    batch: 'W24',
  },
  {
    name: 'DGI Apparel',
    longDescription:
      'DGI Apparel is a one-stop shop for custom screen printers to purchase all of the supplies needed to operate their business. DGI enables users to connect their existing vendor accounts to compare prices, inventory, and shipping time across all of their vendors on a single website. They can also manage all of their vendor carts, checkout, and view purchase tracking and analytics right from DGI.',
    tags: '',
    industries: 'B2B, Supply Chain and Logistics',
    batch: 'W24',
  },
  {
    name: 'Buster',
    longDescription:
      "We're building AI Digital Workers for every part of your analytics & data stack.  You can think of our platform as a 24/7 team of AI data engineers, scientists, & analysts. Its modern, simple, & open source.",
    tags: 'Generative AI, Data Science, Data Engineering, Data Visualization, Databases',
    industries: 'B2B, Analytics',
    batch: 'W24',
  },
  {
    name: 'Garage',
    longDescription:
      'Garage is a marketplace for pre-owned equipment, starting with firefighting equipment.  Garage helps fire departments buy and sell used equipment in seconds rather than days. Our marketplace handles payments, freight, and financing – making buying and selling equipment easy & secure.',
    tags: 'Marketplace',
    industries: 'B2B',
    batch: 'W24',
  },
  {
    name: 'Mango Health',
    longDescription:
      'Mango Health delivers AI-powered therapy for OCD, offering personalized care that adapts to your experience, credibility backed by expert input, and complete anonymity—your data stays private. Start today at TheMangoHealth.com :)',
    tags: 'Health Insurance, Mental Health, AI',
    industries: 'Healthcare',
    batch: 'W24',
  },
  {
    name: 'Argon AI, Inc.',
    longDescription:
      'Argon AI is a platform where biopharma and life sciences professionals can execute complex and data driven workflows using natural language. We help professionals get thorough answers to questions about clinical trials, existing treatments, healthcare landscape, and the competitive market in minutes rather than months.  Prior to starting Argon, Samy was responsible for Flatiron Health’s (Roche) first data analytics project which eventually led to the start of the Flatiron Services business unit. There, he saw first-hand the heavily manual process that biopharma companies struggle through to get the insights they need to drive forward their drug development programs. He also helped close over $6M+ in ARR and is an expert in enterprise pharma sales. Cyrus previously led engineering teams and built 0 to 1 across pre-seed and unicorn startups, managed mission-critical trade generation systems at Bridgewater, and held AI advisory roles at various startups. Cyrus has a duel degree in EE and CS from USC. Breakthroughs in AI present an opportunity to reinvent biopharma and life science workflows to reduce the time and cost of bringing treatments to patients where delays in bringing a drug to market can cost a pharma company $3M / day.',
    tags: '',
    industries: 'Healthcare',
    batch: 'W24',
  },
  {
    name: 'nCompass Technologies',
    longDescription:
      'nCompass is a platform for acceleration and hosting of open-source and custom AI models. We provide low-latency AI deployment without rate-limiting you. All with just one line of code.',
    tags: 'Artificial Intelligence, Hardware, Open Source, API, Cloud Computing',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'W24',
  },
  {
    name: 'Pretzel AI',
    longDescription:
      "**Jupyter is used by millions** of data scientists and analysts but it has _many_ problems. **Pretzel fixes Jupyter's problems** with native AI-tooling, collaboration, modern code-editing features, native SQL support and a visual, AI-assisted data exploration and dashboarding suite. **We're two ex-Stripe founders**. Prasoon worked as a Data Scientist at Stripe, Goldman Sachs and Klarna for over 7 years. We recently launched on GitHub and got **1000 GitHub stars in two weeks**, 500+ DAU, usage at large companies like Stripe and Bayer and 7 new code contributors.",
    tags: 'Artificial Intelligence, Analytics, Collaboration, Open Source, Data Science',
    industries: 'B2B, Analytics',
    batch: 'W24',
  },
  {
    name: 'Apriora',
    longDescription:
      "Apriora conducts live interviews with an AI recruiter. Companies use us to get the best hiring signal on their applicant pool and hire in a fraction of the time. Our AI recruiter has a live conversation over a video call with each of your candidates based on the interview questions you choose or that are recommended based on the job description. During the interview, our AI asks personalized follow-up questions in real-time based on the candidate's responses. Our AI recruiter can be customized to your roles in minutes and has already conducted thousands of interviews across engineering, IT, retail, hospitality, and more.",
    tags: 'Artificial Intelligence, SaaS, B2B, Recruiting, HR Tech',
    industries: 'B2B, Recruiting and Talent',
    batch: 'W24',
  },
  {
    name: 'malibou',
    longDescription:
      "malibou is a web application helping French SMBs to manage employees, run payroll and track compliance in a single app. When processing payroll in France, you either have the choice between an accountant with good advice but no way to connect an HRIS with him, or a good HRIS that does not include payroll services. It was time for a change, to finally bring payroll and HR at the same place.  Due to increasing competition in the space, French payroll engines have just opened their APIs. This allows us to offer a unified payroll and HR solution, which wasn't possible before.",
    tags: 'B2B, Productivity, HR Tech, Payroll, SMB',
    industries: 'B2B, Human Resources',
    batch: 'W24',
  },
  {
    name: 'Quary',
    longDescription:
      'Quary is the first analytics engineering platform that brings the entire model-test-deploy workflow into the browser.  At our first customer, a fast-growing fintech company, Quary empowers analysts in the growth team to self-serve, contribute, and reduce reliance on the data engineering team, letting teams ship metrics faster & executives get answers sooner',
    tags: 'Artificial Intelligence, Analytics, Data Science, Data Engineering, AI',
    industries: 'B2B, Analytics',
    batch: 'W24',
  },
  {
    name: 'Newton',
    longDescription: 'Newton is an AI-powered phone system (VoIP) system for dentists and dental groups.',
    tags: '',
    industries: 'B2B',
    batch: 'W24',
  },
  {
    name: 'Tile',
    longDescription: 'Create production-grade data automations and applications without writing SQL or code',
    tags: 'Artificial Intelligence, SaaS, Analytics, Big Data, Operations',
    industries: 'B2B, Analytics',
    batch: 'W24',
  },
  {
    name: 'Adagy Robotics',
    longDescription:
      'Adagy is a remote intervention service that rescues robots when they fail. For example, when a tractor robot gets lost in a field, instead of calling the farmer for help, it can now call Adagy, whose operators will take control of the robot and remotely drive it back to safety.  We’re starting with trained human operators assisted by generative AI, and as we collect more data, our model will learn to handle more of the edge cases.  We want to see a world with more robots, so we’re addressing the biggest problem in robot deployment: reliability. ',
    tags: '',
    industries: 'Industrials, Manufacturing and Robotics',
    batch: 'W24',
  },
  {
    name: 'Momentic',
    longDescription:
      "Momentic is the most advanced AI platform for testing. We're accelerating engineering teams at companies like Retool, Podium, Chegg, Runway, and many more.",
    tags: 'Artificial Intelligence, Developer Tools, B2B, Enterprise Software',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'W24',
  },
  {
    name: 'Reducto',
    longDescription:
      'Reducto offers robust and reliable document ingestion for any workflow. Our API allows you to convert complex, unstructured documents into structured outputs that are perfect for RAG, process automation, and more. ',
    tags: 'Documents, Artificial Intelligence, Data Engineering, Enterprise Software, Search',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'W24',
  },
  {
    name: 'Andon Labs',
    longDescription: '',
    tags: 'Machine Learning, AI',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'W24',
  },
  {
    name: 'Maia',
    longDescription:
      'Maia helps couples connect more each day. Trained by relationship experts, Maia offers daily activities, personalized advice, proactive insights, quizzes and games through AI and relationship science.',
    tags: '',
    industries: 'Healthcare, Consumer Health and Wellness',
    batch: 'W24',
  },
  {
    name: 'Nuanced, Inc.',
    longDescription:
      "We're building tools that combine static analysis with AI to obtain a deeper understanding of code behavior. By doing so, we help both humans and machines understand code behavior at a fundamental level.",
    tags: 'Developer Tools, AI, AI Assistant',
    industries: 'B2B',
    batch: 'W24',
  },
  {
    name: 'Precip',
    longDescription:
      'Precip uses AI to make hyperlocal weather observations. We’re started with the most important dimension of weather: rain. For example, one of our customers uses Precip daily to make sure their heavy trucks won’t get stuck in muddy fields. Our highly rated mobile app is the best way to see rain and snow totals anywhere.  ',
    tags: 'Consumer, Climate, API, Agriculture, AI',
    industries: 'B2B',
    batch: 'W24',
  },
  {
    name: 'Tracecat',
    longDescription:
      "Tracecat is the open source Tines / Splunk SOAR alternative. Security engineers use our platform to build AI-assisted workflows that automate investigations and incident response. We're building the easiest way for security teams to fight burnout and reduce mean time to respond.",
    tags: 'Artificial Intelligence, Workflow Automation, Open Source, Cybersecurity',
    industries: 'B2B, Security',
    batch: 'W24',
  },
  {
    name: 'Kabilah',
    longDescription:
      'Kabilah is the most trusted enterprise-grade AI platform designed specifically for nursing workflows. We reduce burnout, enhance system efficiency, and enable high quality care.',
    tags: 'Generative AI, Digital Health, Healthcare, AI',
    industries: 'Healthcare',
    batch: 'W24',
  },
  {
    name: 'Sonia',
    longDescription:
      'Sonia is a conversational AI that conducts entire therapy-like sessions both by voice and text via a phone app. 70 million Americans who struggle with their mental health can now access therapy for $200 per year instead of $200 per session. Founded by a team of MIT researchers who published 9 papers on AI at conferences like NeurIPS.',
    tags: '',
    industries: 'Healthcare, Consumer Health and Wellness',
    batch: 'W24',
  },
  {
    name: 'MAIHEM',
    longDescription:
      'MAIHEM creates AI agents that test AI products. We enable companies to automate their AI quality assurance, enhancing AI performance and reliability before and after deployment. ',
    tags: '',
    industries: 'B2B, Analytics',
    batch: 'W24',
  },
  {
    name: 'ion design',
    longDescription:
      "ion design is re-imagining how front end works. For early stage companies, ion allows you to describe a UI in text & get react code that’s tailor-made to your business. ion understands your design system and codebase to generate designs that are beautiful and code that’s easy to work with. Once you've scaled and hired a designer, ion offers a pipeline that automatically converts Figma designs into clean React code that's tailor-fitted to your codebase. We re-use your existing components and variables from your codebase in our generations and can automatically generate PRs and merge conflicts from Figma. ",
    tags: 'Artificial Intelligence, Developer Tools, Design Tools, Web Development',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'W24',
  },
  {
    name: 'Duckie',
    longDescription:
      "Duckie is an AI assistant that helps customer support teams resolve tickets faster! We integrate with existing customer support workflows to respond to customers directly, and answer questions that support agents may have. Does a customer need help onboarding? Duckie is there! Is your support agent looking for info on the latest changes to the product? Duckie is there!  Duckie can be installed anywhere, from Slack and Discord to Zendesk and Intercom. And we integrate with both customer support and engineering knowledge bases to go beyond the documentation. By sourcing information from across your knowledge base, we can step in and help out before questions get sent into the void of escalations. If you're looking to give your customer support team a super power, come to Duckie!",
    tags: 'Artificial Intelligence, Developer Tools, Customer Support, Operations',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'W24',
  },
  {
    name: 'Happenstance',
    longDescription:
      'Happenstance is people search powered by AI. For example, you ask Happenstance "find people who work on notification systems at big companies", and it comes back with two who follow you on Twitter and five who are connected to your partners. That kind of thing you just can\'t do on LinkedIn.',
    tags: 'Artificial Intelligence',
    industries: 'Consumer',
    batch: 'W24',
  },
  {
    name: 'Ubicloud',
    longDescription:
      'Ubicloud is an open source cloud that can run anywhere. Our cloud services include elastic compute, block storage, virtual networking, managed Postgres, and powerful IAM. Ubicloud provides these services on bare metal providers, such as Hetzner, Leaseweb, or AWS Bare Metal. You can self-host our software or use our managed service to reduce your cloud costs by 3-10x.',
    tags: '',
    industries: 'B2B, Infrastructure',
    batch: 'W24',
  },
  {
    name: 'Greptile',
    longDescription:
      'Greptile is an AI that understands large codebases that you can query via an API.  You can: - Use it to chat with your codebase - Plug it into Jira to generate descriptions for tickets, into GitHub to get automate PR reviews etc. with full knowledge of the codebase - Build custom internal tools and automations on top of the API! Greptile can be used via the cloud, or be hosted 100% on your cloud in an air-gapped VPC. Today, 800+ software teams including Wombo, Metamask, Warp, Exa AI, Bland, Leya, and more use Greptile to accelerate their software development lifecycle.  ',
    tags: 'Artificial Intelligence, Developer Tools, AI',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'W24',
  },
  {
    name: 'PurplePages',
    longDescription: '',
    tags: 'Artificial Intelligence, Marketplace, Real Estate, Conversational AI, AI Assistant',
    industries: 'Consumer, Home and Personal',
    batch: 'W24',
  },
  {
    name: 'ego',
    longDescription:
      "We’re building the first generative ai-powered simulation engine, where non-technical creators can generate realistic characters powered by LLMs, 3D worlds, and interaction code/scripts with just prompts. The future of user-generated simulations, games, and interactive media will be powered by our engine. We used our engine to build TownWorld - a 3D interactive Twitch live stream of the Stanford generative agents paper (https://www.twitch.tv/townworld). To the best of our knowledge, it's the first ever AI 3D simulation of a small town in real time YC Launch - https://www.ycombinator.com/launches/KeD-ego-an-ai-native-3d-simulation-engine-getting-us-closer-to-the-matrix-one-pixel-at-a-time Demo video: https://docsend.com/view/mzf6i7kiwkkgg669 AI 3D TownWorld video: https://docsend.com/view/ig6t2shuz26z7wha",
    tags: 'Artificial Intelligence, Generative AI, Consumer, Gaming, AI',
    industries: 'Consumer',
    batch: 'W24',
  },
  {
    name: 'Leya',
    longDescription:
      'Leya is an AI-powered workspace for law firms and legal professionals.  Leya lets lawyers automate their repetitive tasks and access public sources and their own data on one single platform. Learn more at https://www.leya.law/',
    tags: 'Generative AI, LegalTech, AI',
    industries: 'B2B, Legal',
    batch: 'W24',
  },
  {
    name: 'Scritch',
    longDescription:
      'Scritch is building the leading AI operating system for veterinary care. We provide AI agents to streamline operations including scheduling and clinical workflows.',
    tags: 'Consumer Health Services, Health Tech, B2B, Healthcare, AI',
    industries: 'Healthcare',
    batch: 'W24',
  },
  {
    name: 'RadMate AI',
    longDescription:
      'We’re building the AI copilot for radiologists, powered by a foundational model for medical imaging. RadMate AI will read radiology images and generate full reports for radiologists to review and submit. Mohamed and Adam are technical co-founders who met while studying Computer Science at Cornell University. Before starting RadMate AI to solve the problems his dad faced as a radiologist, Adam worked at Palantir on the initial launch of Palantir’s Al Platform. Mohamed has experience at AWS, where his goal was to help enterprises innovate on the cloud, and PathAl, where he worked on their image viewer platform to improve the workflow of pathologists. ',
    tags: 'Artificial Intelligence, SaaS, Digital Health, Enterprise Software, AI Assistant',
    industries: 'Healthcare',
    batch: 'W24',
  },
  {
    name: 'SSOReady',
    longDescription:
      'Large contracts with large companies usually require software companies to offer SAML SSO and SCIM.  Implementing SAML SSO and SCIM yourself is pretty hard and not a good use of your time.  We make it really easy to implement SAML SSO and SCIM in your product. ',
    tags: 'Developer Tools, SaaS, Security, Open Source, API',
    industries: 'B2B',
    batch: 'W24',
  },
  {
    name: 'Relari',
    longDescription:
      'Relari helps AI teams simulate, test, and validate complex AI applications throughout the development lifecycle. We are the company behind continuous-eval, an open-source modular evaluation framework with metrics covering text generation, code generation, retrieval, classification, agents, and other LLM use cases. Our cloud platform generates custom synthetic data and simulates user behavior to stress test and harden GenAI applications.',
    tags: '',
    industries: 'B2B, Infrastructure',
    batch: 'W24',
  },
  {
    name: 'DryMerge',
    longDescription:
      'DryMerge lets people automate work with plain English. Say you want to manage inbound leads. Instead of dragging blocks or writing code, just tell DryMerge "Whenever I get an email from a potential customer, add their details to a google sheet and draft a reachout message" and watch it happen in seconds. Counterintuitively, 88% of no-code users are actually programmers. We\'re changing that by making automation as fast and intuitive as conversation. This opens up the market to all knowledge workers, not just technical ones, and expands it by an order of magnitude. ',
    tags: '',
    industries: 'B2B',
    batch: 'W24',
  },
  {
    name: 'Navier AI',
    longDescription:
      "Navier AI is making CFD 1000x faster with their ML-based solver. Physics simulations, such as Computational Fluid Dynamics (CFD), are essential across many industries ranging from the design and analysis of aircraft, to weather prediction, to the development of medical devices. Today’s simulation tools use explicit numerical solvers for physical equations, such as the Naiver-Stokes equations. These solvers are complex to setup and can take ages to produce results. Navier AI is building 1000x faster simulations using physics-ML solvers. Navier AI's fast CFD platform will enable engineers to quickly explore design spaces and perform analysis-in-the-loop design optimization. They are lowering the barrier to entry for aerospace and mechanical engineers to create high performance designs.",
    tags: '',
    industries: 'Industrials, Aviation and Space',
    batch: 'W24',
  },
  {
    name: 'Upsolve AI',
    longDescription:
      "Upsolve AI is a customer-facing analytics as a service platform. We are building a full data stack that enables businesses to build and offer analytics to their customers at lightning speed and gives their customers the superpower to answer any data questions via AI. The company is founded by Ka Ling Wu and Serguei Balanovich, who built a similar product at Palantir before (featured in Palantir's S-1), growing it to 50+ enterprise customers and 8-figures of annual revenue in 2 years.",
    tags: 'Developer Tools, B2B, Analytics, Big Data, AI',
    industries: 'B2B, Analytics',
    batch: 'W24',
  },
  {
    name: 'SciPhi',
    longDescription:
      'Use R2R to start your AI application with auth, document management, hybrid vector search, advanced/agentic RAG, and more. ',
    tags: 'Artificial Intelligence, Developer Tools, Search, Infrastructure, AI',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'W24',
  },
  {
    name: 'Gumloop',
    longDescription:
      'Gumloop is a platform for automating repetitive and complex workflows end-to-end with AI.  Builders drag, drop, and connect modular components onto a canvas to build powerful automations. We provide the tools and the infrastructure to operate at 10x the speed of writing, testing, and productionizing code so you can focus on the problem at hand. ',
    tags: '',
    industries: 'B2B',
    batch: 'W24',
  },
  {
    name: 'Driver AI',
    longDescription:
      'Driver AI is the new way to write technical documentation. It helps everyone in an organization write interactive documents to explain millions of lines of code in minutes instead of months. WHO: We partner with chip manufacturing, enterprise IT, and software product development teams. WHY: Traditionally, these teams spend millions and wait months (sometimes years) to understand their complex technology infrastructure well enough to build on top of it.  THE DRIVER DIFFERENCE: Instead, Driver AI is a tool that explains complex codebases in minutes vs. months. This enables teams to rapidly accelerate the technical discovery process and save significant resources.  HOW IT WORKS: Driver AI works by digesting a codebase, organizing it for analysis, and harnessing Large Language Models (LLMs) to generate interactive explanations for executives, product and technology leaders, and developers. "Driver AI is a paradigm shift for managing our complex software delivery pipeline." - Executive Vice President, Global Semiconductor Company',
    tags: '',
    industries: 'B2B',
    batch: 'W24',
  },
  {
    name: 'Lantern',
    longDescription:
      'Lantern is the easiest way to build AI applications using Postgres. We started Lantern because we believe AI is going to impact every single enterprise in every single industry. We want to allow every company to tap into their unstructured data to build better applications. With Lantern Cloud, developers have access to everything they need to build an AI application: embedding generation, vector compression, vector search, efficient indexing, and more. All on top of the database they already know, Postgres, and using infrastructure that scales to billions. Check out our code on Github: https://github.com/lanterndata/lantern',
    tags: 'Artificial Intelligence, B2B, Open Source, Enterprise, Databases',
    industries: 'B2B',
    batch: 'W24',
  },
  {
    name: 'Onyx',
    longDescription:
      "Onyx is the AI assistant that connects to all your company tools and docs and makes finding any piece of information a breeze. Think ChatGPT, but with access to all your companies documents (only the ones you have access to, of course :P). Or, if you know Glean, you can think about it like an open-source Glean.  Concerned about your data? Don't worry we're open source (MIT license) and built to be self-hosted. You can setup Onyx in your VPC in less than 30 minutes - no packets ever have to leave your cloud. Check us out on Github: https://github.com/onyx-dot-app/onyx!",
    tags: 'Open Source, NLP, Enterprise, Search',
    industries: 'B2B, Productivity',
    batch: 'W24',
  },
  {
    name: 'jo',
    longDescription:
      'jo is a voice-first digital personality that works alongside you every day – a smart and efficient new friend who saves you time and money while improving your quality of life. As of now, jo runs only on macOS desktop, and only on Apple Silicon.',
    tags: 'Artificial Intelligence, Consumer, AI, AI Assistant',
    industries: 'Consumer',
    batch: 'W24',
  },
  {
    name: 'Yenmo',
    longDescription:
      'Yenmo offers a better way to access cash for India’s 65 million investors who either resort to personal loans at over 18% interest or have to liquidate their investments when in need of money. With Yenmo, they can pledge their investments digitally and instantly get a loan at a fixed 10.5% interest rate. Our Insight - In India, over 30% of personal loan borrowers have active investments and are paying double the interest rate they qualify for with us.',
    tags: 'Fintech, Lending, Consumer Finance',
    industries: 'Fintech, Credit and Lending',
    batch: 'W24',
  },
  {
    name: 'GovernGPT',
    longDescription:
      'For money managers to raise their next billion, they dedicate entire teams to spend days filling diligence questionnaires with recycled content. We do it in minutes using AI. ',
    tags: 'Artificial Intelligence, Finance, B2B, Investing, AI',
    industries: 'Fintech',
    batch: 'W24',
  },
  {
    name: 'Arcane',
    longDescription:
      'Arcane is building an AI powered game platform. We allow anyone to create and play games, without writing code.',
    tags: 'Artificial Intelligence, Generative AI, Consumer, Gaming, AI',
    industries: 'Consumer, Gaming',
    batch: 'W24',
  },
  {
    name: 'Fileforge',
    longDescription:
      'Fileforge is an API for PDF document workflows.  With Fileforge, you can generate, manipulate, host, share, sign and track your documents - all in on place. Our open-source library helps developers build complex documents that integrate with our API and external services to build document-centric workflows.',
    tags: 'Documents, Developer Tools, B2B, API',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'W24',
  },
  {
    name: 'Abel',
    longDescription:
      'Abel transforms law firm document review workflows, eliminating the need to choose between depth and breadth. Attorneys use Abel to answer nuanced questions based on the context spread across thousands of documents.',
    tags: 'Artificial Intelligence, Generative AI, B2B, Legal, LegalTech',
    industries: 'B2B, Legal',
    batch: 'W24',
  },
  {
    name: 'Celest',
    longDescription:
      'Celest is a backend-as-a-service for Flutter and Dart developers. It empowers Flutter developers with the tools and capabilities they need to become full-stack developers. We are introducing "Cloud Widgets", a set of primitives which enable you to declaratively define every piece of your backend and infrastructure in Dart. As the role of the front-end developer evolves towards full-stack proficiency, we recognize that existing tools have fallen short for those specializing in Flutter. Using the programming language and patterns Flutter developers already know from building their frontend, Celest enables developers to build and connect their apps to their backend with no additional tooling. We enable Flutter developers to concentrate on building features and delivering value to their customers rather than learning additional domains and fragmenting themselves across disparate toolchains.',
    tags: 'Developer Tools, SaaS, B2B, Cloud Computing, Infrastructure',
    industries: 'B2B, Infrastructure',
    batch: 'W24',
  },
  {
    name: 'Blume Benefits',
    longDescription:
      'Blume is a web app that streamlines insurance quoting, renewal, and revenue ops processes for health insurance brokers. We are working with our first cohort of health insurance brokers to help them save the, on average, 6 hours of manual data entry they do every week.',
    tags: 'Health Insurance, AI, AI Assistant',
    industries: 'Fintech, Insurance',
    batch: 'W24',
  },
  {
    name: 'Patchwork',
    longDescription:
      'Patchwork replaces your inefficient Slack with an intelligent feed personalized for each team member with all of their daily updates, design and engineering discussions, and announcements. ',
    tags: 'SaaS, B2B, Productivity, Collaboration, AI',
    industries: 'B2B, Productivity',
    batch: 'W24',
  },
  {
    name: 'Stitch Technologies',
    longDescription: '',
    tags: 'Developer Tools, SaaS',
    industries: 'B2B, Engineering, Product and Design',
    batch: 'W24',
  },
];

export default YC_DATA;
