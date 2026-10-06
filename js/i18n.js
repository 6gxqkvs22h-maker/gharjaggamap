/* English / Nepali switch.
   English is the default. The choice is kept on the phone (gjm_lang).
   How it works: the pages are written in English. When Nepali is on, every piece of English text that appears on the
   page is looked up here and swapped for Nepali, including text the site draws later (cards, details, messages).
   Anything the owner types (titles, descriptions, place names, the owner's own words) is never touched.
   To fix or add a word, edit the lists below. Nothing else needs to change. */
(function () {
  'use strict';
  var KEY = 'gjm_lang';
  var lang = 'en';
  try { if (localStorage.getItem(KEY) === 'ne') lang = 'ne'; } catch (e) {}

  /* ---------- whole phrases ---------- */
  var D = {
    'Contact': 'सम्पर्क', 'Ask': 'सोध्नुहोस्', 'Ask AI': 'AI लाई सोध्नुहोस्', 'Menu': 'मेनु', 'Close': 'बन्द गर्नुहोस्', 'Map': 'नक्सा', 'Properties': 'सम्पत्ति',
    'Featured': 'विशेष', 'Latest': 'नयाँ', 'View all': 'सबै हेर्नुहोस्', 'Property type': 'सम्पत्तिको प्रकार',
    'Previous property': 'अघिल्लो सम्पत्ति', 'Next property': 'अर्को सम्पत्ति',
    'Nearby highlights': 'नजिकका विशेष सम्पत्ति', 'More to see': 'अरू हेर्नुहोस्', 'All properties': 'सबै सम्पत्ति',
    'Sale or rent': 'बिक्री वा भाडा', 'Place': 'ठाउँ', 'Sort': 'क्रम', 'Newest first': 'नयाँ पहिले', 'Lowest price': 'सबैभन्दा सस्तो',
    'Highest price': 'सबैभन्दा महँगो', 'Nearest to me': 'मेरो नजिक', 'Saved': 'सुरक्षित', 'More filters': 'थप फिल्टर',
    'Price from (Rs.)': 'मूल्य, कम्तीमा (रु.)', 'Price up to (Rs.)': 'मूल्य, बढीमा (रु.)', '20 lakh': '२० लाख', '1.5 crore': '१.५ करोड',
    'Size at least': 'कम्तीमा साइज', 'Size unit': 'साइजको एकाइ', 'Anna': 'आना', 'Ropani': 'रोपनी', 'sq ft': 'वर्ग फिट', 'sq m': 'वर्ग मिटर',
    'Bedrooms / BHK': 'बेडरूम / BHK', 'Any': 'जुनसुकै', 'Road width': 'सडकको चौडाइ', 'Clear these filters': 'फिल्टर हटाउनुहोस्',
    'Loading properties…': 'सम्पत्ति लोड हुँदैछ…', 'Browse by place': 'ठाउँअनुसार हेर्नुहोस्',
    'Tap a place to zoom the map to it. The land price is the average of the plots listed there.': 'नक्सा त्यही ठाउँमा लैजान ठाउँमा थिच्नुहोस्। जग्गाको मूल्य त्यहाँ सूचीमा रहेका प्लटहरूको औसत हो।',
    'What can your budget buy?': 'तपाईंको बजेटमा के किन्न सकिन्छ?',
    'Type how much you can spend. You will see which properties fit, explained in plain words.': 'कति खर्च गर्न सक्नुहुन्छ लेख्नुहोस्। कुन सम्पत्ति मिल्छ भन्ने सरल भाषामा देखिन्छ।',
    'Your budget (Rs.)': 'तपाईंको बजेट (रु.)', '50 lakh, 1.2 crore or 5000000': '५० लाख, १.२ करोड वा ५००००००', 'Looking for': 'के खोज्दै हुनुहुन्छ',
    'Show what fits': 'के मिल्छ देखाउनुहोस्', 'Or tap one:': 'वा एउटा छान्नुहोस्:', 'Purpose (optional)': 'उद्देश्य (ऐच्छिक)',
    'For example: to build a family home near a road': 'उदाहरण: सडक नजिक परिवारको घर बनाउन',
    'Ask AI to explain': 'AI लाई बुझाउन भन्नुहोस्', 'Stop': 'रोक्नुहोस्',
    'Written by AI from the listings on this page. It can make mistakes, so confirm every detail with the owner.': 'यस पृष्ठका सूचीबाट AI ले लेखेको। गल्ती हुन सक्छ, त्यसैले हरेक विवरण मालिकसँग पुष्टि गर्नुहोस्।',
    'Clear budget': 'बजेट हटाउनुहोस्',
    'Open a listing to get directions on Google Maps. Prices are asking prices in Nepali rupees. 1 Ropani is 16 Anna, 1 Anna is 4 Paisa, 1 Paisa is 4 Daam, and 1 Anna is 342.25 sq ft (31.8 sq m).': 'गुगल म्यापमा बाटो हेर्न कुनै सम्पत्ति खोल्नुहोस्। मूल्यहरू नेपाली रुपैयाँमा माग गरिएको मूल्य हुन्। १ रोपनी = १६ आना, १ आना = ४ पैसा, १ पैसा = ४ दाम, र १ आना = ३४२.२५ वर्ग फिट (३१.८ वर्ग मिटर)।',
    'Owner sign in': 'मालिक साइन इन', 'Owner tools': 'मालिकका औजार',
    /* menu */
    'Saved properties': 'सुरक्षित सम्पत्ति', 'Ask about properties': 'सम्पत्तिबारे सोध्नुहोस्', 'Ask AI about properties': 'सम्पत्तिबारे AI लाई सोध्नुहोस्',
    'How to use': 'कसरी प्रयोग गर्ने', 'Social media': 'सामाजिक सञ्जाल', 'My profile': 'मेरो प्रोफाइल', 'Continue with Google': 'Google सँग जारी राख्नुहोस्',
    'Sign out': 'साइन आउट', 'Language': 'भाषा',
    'Watch the video': 'भिडियो हेर्नुहोस्',
    'Open a property.': 'सम्पत्ति खोल्नुहोस्।', 'Tap a pin on the map, or a photo below it.': 'नक्सामा पिनमा वा तल फोटोमा थिच्नुहोस्।',
    'See one kind.': 'एक प्रकार हेर्नुहोस्।',
    'Tap Land, House, Flat, Room, Business or Shutter. “View all” has more filters: sale or rent, place, price, size, bedrooms and road width.': 'जग्गा, घर, फ्ल्याट, कोठा, व्यापार वा सटरमा थिच्नुहोस्। “सबै हेर्नुहोस्” मा थप फिल्टर छन्: बिक्री वा भाडा, ठाउँ, मूल्य, साइज, बेडरूम र सडकको चौडाइ।',
    'Save it.': 'सुरक्षित राख्नुहोस्।', 'Tap the heart. Saved properties stay on this phone, under Saved.': 'मुटुमा थिच्नुहोस्। सुरक्षित सम्पत्ति यही फोनमा “सुरक्षित” मा रहन्छन्।',
    'Ask about it.': 'सोध्नुहोस्।', 'Press Contact to call or send a message.': 'फोन गर्न वा सन्देश पठाउन “सम्पर्क” थिच्नुहोस्।',
    'Go there.': 'त्यहाँ जानुहोस्।', '“Get directions” opens Google Maps at the exact spot.': '“बाटो देखाउनुहोस्” ले ठ्याक्कै त्यही ठाउँमा गुगल म्याप खोल्छ।',
    /* chat */
    'Your question': 'तपाईंको प्रश्न', 'Land under 1 crore in Sanepa': 'सानेपामा १ करोडभित्रको जग्गा', 'Send': 'पठाउनुहोस्',
    'Contact the owner': 'मालिकलाई सम्पर्क गर्नुहोस्', 'Looking…': 'खोज्दैछु…',
    'Written by AI. It can make mistakes, so confirm the details with the owner.': 'AI ले लेखेको। गल्ती हुन सक्छ, विवरण मालिकसँग पुष्टि गर्नुहोस्।',
    'Found in the listings on this site.': 'यो साइटका सूचीमा भेटियो।',
    /* interest and profile */
    'I am interested': 'म इच्छुक छु',
    'Continue with Google so the owner knows who to reply to. Your name and email are sent to the owner only. They are not shown on the site.': 'मालिकले कसलाई जवाफ दिने थाहा पाउन Google सँग जारी राख्नुहोस्। तपाईंको नाम र इमेल मालिकलाई मात्र पठाइन्छ। साइटमा देखाइँदैन।',
    'Your phone number (optional)': 'तपाईंको फोन नम्बर (ऐच्छिक)', 'Message (optional)': 'सन्देश (ऐच्छिक)',
    'For example: I would like to visit this weekend': 'उदाहरण: म यो हप्ताको अन्त्यमा हेर्न चाहन्छु',
    'Cancel': 'रद्द गर्नुहोस्', 'Send to the owner': 'मालिकलाई पठाउनुहोस्', 'Your phone number': 'तपाईंको फोन नम्बर',
    'Only the owner sees it, so they can call you back about a property.': 'मालिकले मात्र देख्छन्, ताकि सम्पत्तिबारे तपाईंलाई फोन गर्न सकून्।', 'Save': 'सेभ गर्नुहोस्',
    'Interest sent to the owner': 'मालिकलाई चासो पठाइयो',
    /* cards and details */
    'View details': 'विवरण हेर्नुहोस्', 'Get directions': 'बाटो देखाउनुहोस्', 'Share link': 'लिङ्क सेयर गर्नुहोस्', 'Copied': 'कपी भयो',
    'View video / post': 'भिडियो / पोस्ट हेर्नुहोस्', 'It has': 'यसमा छ', 'Where it is': 'यो कहाँ छ', 'Show on the big map': 'ठूलो नक्सामा देखाउनुहोस्',
    'Property details': 'सम्पत्तिको विवरण', 'Total price': 'कुल मूल्य', 'Deposit': 'डिपोजिट', 'Distance': 'दूरी', 'Status': 'स्थिति', 'District': 'जिल्ला',
    'Price on request': 'मूल्य सोधपुछ गर्नुहोस्',
    'Built-up area': 'निर्मित क्षेत्रफल', 'Land size': 'जग्गाको साइज', 'Land area': 'जग्गाको क्षेत्रफल', 'Flat size': 'फ्ल्याटको साइज', 'Shutter size': 'सटरको साइज',
    'Room size': 'कोठाको साइज', 'BHK': 'BHK', 'Room type': 'कोठाको प्रकार', 'Suitable business': 'उपयुक्त व्यवसाय',
    'Road type': 'सडकको प्रकार', 'Facing': 'फर्केको दिशा', 'Land shape': 'जग्गाको आकार', 'Land surface': 'जग्गाको सतह', 'Frontage': 'अगाडिको लम्बाइ',
    'Number of road sides': 'सडक पर्ने तर्फ', 'Bedrooms': 'बेडरूम', 'Bathrooms': 'बाथरूम', 'Floors': 'तल्ला', 'Parking': 'पार्किङ', 'Furnishing': 'फर्निचर',
    'Water': 'पानी', 'Electricity': 'बिजुली', 'Internet / Wi-Fi': 'इन्टरनेट / वाइफाइ', 'Lift': 'लिफ्ट', 'Balcony': 'बालकोनी', 'Suitable for': 'उपयुक्त',
    'Built year': 'बनेको वर्ष', 'Kitta number': 'कित्ता नम्बर', 'Nearby landmark': 'नजिकको चिनारी', 'Drainage': 'ढल', 'Kitchens': 'भान्सा',
    'Living rooms': 'बैठक कोठा', 'Dining room': 'खाने कोठा', 'Terrace': 'टेरेस', 'Solar': 'सोलार', 'Garden': 'बगैंचा', 'Compound': 'कम्पाउन्ड',
    'Earthquake resistant': 'भूकम्प प्रतिरोधी', 'Rooms': 'कोठा', 'Current use': 'हालको प्रयोग', 'Floor': 'तल्ला', 'Bathroom': 'बाथरूम', 'Kitchen': 'भान्सा',
    'Living room': 'बैठक कोठा', 'Bed included': 'बेड सहित', 'Security': 'सुरक्षा', 'Pet friendly': 'घरपालुवा जनावर मिल्छ',
    'East': 'पूर्व', 'West': 'पश्चिम', 'North': 'उत्तर', 'South': 'दक्षिण', 'North-East': 'उत्तर-पूर्व', 'North-West': 'उत्तर-पश्चिम', 'South-East': 'दक्षिण-पूर्व', 'South-West': 'दक्षिण-पश्चिम',
    'Blacktopped': 'कालोपत्रे', 'Concrete': 'ढलान', 'Gravel': 'ग्राभेल', 'Dirt': 'कच्ची', 'Highway': 'राजमार्ग', 'Other': 'अन्य',
    'Rectangular': 'आयताकार', 'Square': 'वर्गाकार', 'Irregular': 'अनियमित', 'Slightly sloped': 'थोरै भिरालो', 'Sloped': 'भिरालो',
    'None': 'छैन', 'Bike': 'बाइक', 'Car': 'कार', 'Both': 'दुवै', 'Furnished': 'फर्निचर सहित', 'Semi-furnished': 'आंशिक फर्निचर', 'Unfurnished': 'फर्निचर बिना',
    'Attached': 'जोडिएको', 'Shared': 'साझा', 'Basement': 'बेसमेन्ट', 'Ground floor': 'भुइँतला',
    'Residential': 'आवासीय', 'Commercial': 'व्यावसायिक', 'Hotel': 'होटल', 'Restaurant': 'रेस्टुरेन्ट', 'Office': 'कार्यालय', 'School': 'विद्यालय', 'Hostel': 'होस्टल',
    'Warehouse': 'गोदाम', 'Showroom': 'सोरुम', 'Factory': 'कारखाना', 'Commercial building': 'व्यावसायिक भवन', 'Grocery': 'किराना', 'Clothing': 'कपडा', 'Salon': 'सैलुन',
    'Workshop': 'वर्कशप', 'Student': 'विद्यार्थी', 'Students': 'विद्यार्थी', 'Working professional': 'कार्यरत पेशाकर्मी', 'Working professionals': 'कार्यरत पेशाकर्मी',
    'Couple': 'जोडी', 'Family': 'परिवार', 'Anyone': 'जो कोही', 'Studio': 'स्टुडियो', 'Single room': 'एकल कोठा', 'Double room': 'डबल कोठा', 'Room + kitchen': 'कोठा + भान्सा',
    /* kinds, deals, statuses */
    'Land': 'जग्गा', 'House': 'घर', 'Business': 'व्यापार', 'Shutter': 'सटर', 'Room': 'कोठा', 'Flat': 'फ्ल्याट', 'Commercial property': 'व्यावसायिक सम्पत्ति', 'Studio flat': 'स्टुडियो फ्ल्याट',
    'All': 'सबै', 'All types': 'सबै प्रकार', 'For sale': 'बिक्रीमा', 'For rent': 'भाडामा', 'Anything': 'जुनसुकै', 'All places': 'सबै ठाउँ',
    'Available': 'उपलब्ध', 'Sold': 'बिक्री भयो', 'Rented': 'भाडामा लागिसक्यो',
    /* empty states and messages */
    'Nothing saved yet. Tap the heart on a property to keep it here.': 'अहिलेसम्म केही सुरक्षित गरिएको छैन। यहाँ राख्न सम्पत्तिमा मुटुमा थिच्नुहोस्।',
    'Nothing matches these filters yet.': 'यी फिल्टरसँग मिल्ने केही छैन।', 'Show all properties': 'सबै सम्पत्ति देखाउनुहोस्',
    'No properties are listed yet, so the map has no pins. The owner adds them after pressing “Owner sign in” at the top.': 'अहिलेसम्म कुनै सम्पत्ति सूचीमा छैन, त्यसैले नक्सामा पिन छैन।',
    'Nothing is available in this category right now.': 'यस वर्गमा अहिले केही उपलब्ध छैन।', 'No properties are listed yet.': 'अहिलेसम्म कुनै सम्पत्ति सूचीमा छैन।',
    'Saved on this phone. Find it under Saved.': 'यही फोनमा सुरक्षित भयो। “सुरक्षित” मा भेट्नुहुनेछ।', 'Removed from saved.': 'सुरक्षितबाट हटाइयो।',
    'Press and hold the text to copy it.': 'कपी गर्न लेखमा थिचिराख्नुहोस्।', 'Finding where you are…': 'तपाईं कहाँ हुनुहुन्छ खोज्दैछु…',
    'The blue dot is where you are.': 'निलो थोप्लो तपाईं भएको ठाउँ हो।', 'This device cannot share its location.': 'यो उपकरणले लोकेसन दिन सक्दैन।',
    'Could not get your location. Allow location for this site in your browser settings.': 'तपाईंको लोकेसन पाइएन। ब्राउजर सेटिङमा यो साइटलाई लोकेसन अनुमति दिनुहोस्।',
    'Type your budget as a number, for example 50 lakh, 1.2 crore or 25000 a month.': 'बजेट संख्यामा लेख्नुहोस्, जस्तै ५० लाख, १.२ करोड वा महिनाको २५०००।',
    'Version': 'संस्करण',
    'Sent. The owner will contact you.': 'पठाइयो। मालिकले तपाईंलाई सम्पर्क गर्नुहुनेछ।', 'Phone number saved.': 'फोन नम्बर सेभ भयो।', 'Phone number removed.': 'फोन नम्बर हटाइयो।',
    'Signed out.': 'साइन आउट भयो।', 'Google sign-in could not start. Try again in a moment.': 'Google साइन इन सुरु भएन। केही बेरमा फेरि प्रयास गर्नुहोस्।',
    'That property is no longer listed. Here is everything that is available.': 'त्यो सम्पत्ति अब सूचीमा छैन। उपलब्ध सबै यहाँ छन्।',
    'Could not save it just now. Try again in a moment.': 'अहिले सेभ गर्न सकिएन। केही बेरमा फेरि प्रयास गर्नुहोस्।',
    'No connection. Check the internet and try again.': 'इन्टरनेट छैन। जाँच गरेर फेरि प्रयास गर्नुहोस्।',
    /* contact */
    'You are asking about': 'तपाईं यसबारे सोध्दै हुनुहुन्छ', 'Contact details are not added yet.': 'सम्पर्क विवरण अहिलेसम्म थपिएको छैन।',
    'Full details, papers and site visits are arranged directly with the owner.': 'पूर्ण विवरण, कागजात र साइट भ्रमण मालिकसँग सिधै मिलाइन्छ।',
    'Call or text': 'फोन वा म्यासेज', 'Call': 'फोन गर्नुहोस्', 'Copy number': 'नम्बर कपी गर्नुहोस्', 'Message on WhatsApp': 'WhatsApp मा सन्देश',
    'Message you can send': 'तपाईंले पठाउन सक्ने सन्देश', 'Copy message': 'सन्देश कपी गर्नुहोस्'
  };

  var UNIT = { 'Ropani': 'रोपनी', 'Anna': 'आना', 'Paisa': 'पैसा', 'Daam': 'दाम', 'Bigha': 'बिघा', 'Kattha': 'कठ्ठा', 'Dhur': 'धुर', 'sq ft': 'वर्ग फिट', 'sq m': 'वर्ग मिटर' };
  var DIR = { 'East': 'पूर्व', 'West': 'पश्चिम', 'North': 'उत्तर', 'South': 'दक्षिण', 'North-East': 'उत्तर-पूर्व', 'North-West': 'उत्तर-पश्चिम', 'South-East': 'दक्षिण-पूर्व', 'South-West': 'दक्षिण-पश्चिम' };
  var ORD = ['', 'पहिलो', 'दोस्रो', 'तेस्रो', 'चौथो', 'पाँचौं', 'छैटौं', 'सातौं', 'आठौं', 'नवौं', 'दसौं'];
  var ORDK = ['th', 'st', 'nd', 'rd'];

  // Money and units inside any sentence (prices, sizes, distances).
  function money(s) {
    return s.replace(/\bRs\.\s?/g, 'रु. ')
      .replace(/\bcrore\b/g, 'करोड').replace(/\blakh\b/g, 'लाख')
      .replace(/\/month\b/g, '/महिना').replace(/\/mo\b/g, '/महिना').replace(/\ba month\b/g, 'प्रति महिना')
      .replace(/\bper (Ropani|Anna|Paisa|Daam|Bigha|Kattha|Dhur)\b/g, function (m, u) { return 'प्रति ' + UNIT[u]; })
      .replace(/\b(Ropani|Anna|Paisa|Daam|Bigha|Kattha|Dhur)\b/g, function (m, u) { return UNIT[u]; })
      .replace(/\bsq ft\b/g, 'वर्ग फिट').replace(/\bsq m\b/g, 'वर्ग मिटर')
      .replace(/\b(\d+(?:\.\d+)?) km\b/g, '$1 कि.मि.').replace(/\b(\d+) m\b/g, '$1 मि.')
      .replace(/ from you\b/g, ' टाढा').replace(/ away\b/g, ' टाढा');
  }
  function kinds(s) {
    return s.replace(/\b(Studio flat|Commercial property|Land|House|Flat|Room|Shutter|Business|Office|Studio|Hotel|Restaurant|Hostel|School|Warehouse|Factory|Showroom|Commercial building)\b/g, function (m) { return D[m] || m; });
  }
  function floorWord(n, sfx) { n = +n; return (n >= 1 && n <= 10 ? ORD[n] : n + 'औं') + ' तल्ला'; }

  // Pieces of sentences, tried when the whole text is not in the list above. Each returns Nepali or null.
  var RULES = [
    [/^(\d+) or more$/, function (m) { return m[1] + ' वा बढी'; }],
    [/^(\d+) ft or wider$/, function (m) { return m[1] + ' फिट वा बढी चौडा'; }],
    [/^More filters \((\d+)\)$/, function (m) { return 'थप फिल्टर (' + m[1] + ')'; }],
    [/^(\d+) propert(?:y|ies)\s*(.*)$/, function (m) {
      var bits = m[2] ? m[2].split(', ').map(function (b) {
        var x;
        if (b === 'for rent') return 'भाडामा';
        if (b === 'for sale') return 'बिक्रीमा';
        if (b === 'saved by you') return 'तपाईंले सुरक्षित गरेका';
        if ((x = /^in (.+)$/.exec(b))) return x[1] + 'मा';
        if ((x = /^within or near (.+)$/.exec(b))) return money(x[1]) + ' वरिपरि';
        if ((x = /^(\d+) more filters?$/.exec(b))) return x[1] + ' थप फिल्टर';
        return b;
      }) : [];
      return m[1] + ' सम्पत्ति' + (bits.length ? ' · ' + bits.join(', ') : '');
    }],
    [/^(\d+) photos$/, function (m) { return m[1] + ' फोटो'; }],
    [/^Total (.+)$/, function (m) { return 'कुल ' + money(m[1]); }],
    [/^Deposit (Rs\..+)$/, function (m) { return 'डिपोजिट ' + money(m[1]); }],
    [/^Price per (Ropani|Anna|Paisa|Daam|Bigha|Kattha|Dhur)$/, function (m) { return 'प्रति ' + UNIT[m[1]] + ' मूल्य'; }],
    [/^View video \/ post on (.+)$/, function (m) { return m[1] + ' मा भिडियो / पोस्ट हेर्नुहोस्'; }],
    [/^Contact (?!the owner)(.+)$/, function (m) { return m[1] + ' लाई सम्पर्क'; }],
    [/^(.+) for (sale|rent)$/, function (m) { return kinds(m[1]) + ' ' + (m[2] === 'sale' ? 'बिक्रीमा' : 'भाडामा'); }],
    [/^(\d+) bedrooms?$/, function (m) { return m[1] + ' बेडरूम'; }],
    [/^(\d+(?:\.\d+)?) floors?$/, function (m) { return m[1] + ' तल्ला'; }],
    [/^(\d+(?:\.\d+)?) ft road$/, function (m) { return m[1] + ' फिट सडक'; }],
    [/^(\d+) sides?$/, function (m) { return m[1] + ' तर्फ'; }],
    [/^(\d+(?:\.\d+)?) ft$/, function (m) { return m[1] + ' फिट'; }],
    [/^(East|West|North|South|North-East|North-West|South-East|South-West) facing$/, function (m) { return DIR[m[1]] + 'मुखी'; }],
    [/^(.+) built-up$/, function (m) { return money(m[1]) + ' निर्मित'; }],
    [/^Bike parking$/, function () { return 'बाइक पार्किङ'; }], [/^Car parking$/, function () { return 'कार पार्किङ'; }],
    [/^Bike and car parking$/, function () { return 'बाइक र कार पार्किङ'; }], [/^No parking$/, function () { return 'पार्किङ छैन'; }],
    [/^(Attached|Shared) bathroom$/, function (m) { return D[m[1]] + ' बाथरूम'; }],
    [/^(\d+)(?:st|nd|rd|th) floor$/, function (m) { return floorWord(m[1]); }],
    [/^(\d+) (?:Anna|Ropani|Paisa|Daam|Bigha|Kattha|Dhur|sq ft|sq m)(?: \(.+\))?$/, function (m) { return money(m[0]); }],
    [/^(\d+(?:\.\d+)?) (?:crore|lakh)$/, function (m) { return money(m[0]); }]
  ];

  // Money, sizes and distances appear in many sentences; this pass only touches those words.
  var LOOSE = /\bRs\.|\b(?:crore|lakh)\b|\/mo(?:nth)?\b|\bper (?:Ropani|Anna|Paisa|Daam|Bigha|Kattha|Dhur)\b|\b\d(?:[\d,.]*) (?:km|m|Anna|Ropani|Paisa|Daam|Kattha|Dhur|sq ft|sq m)\b|\ba month\b/;

  function translate(raw, loose) {
    var m = /^(\s*)([\s\S]*?)(\s*)$/.exec(raw), core = m[2];
    if (!core || /[ऀ-ॿ]/.test(core) && !/[A-Za-z]{3}/.test(core)) return raw;
    var hit = D[core];
    if (hit == null) {
      for (var i = 0; i < RULES.length; i++) {
        var r = RULES[i][0].exec(core);
        if (r) { hit = RULES[i][1](r); break; }
      }
    }
    if (hit == null && loose && LOOSE.test(core)) hit = money(core);
    return hit == null || hit === core ? raw : m[1] + hit + m[3];
  }

  /* ---------- the page: text nodes and a few attributes ---------- */
  // Things the owner or a visitor typed. They are left exactly as written.
  var SKIP = '.card-title,.card-place,.card-body .where,.where,.desc,.fsize,.nplace,.ntext b,.about-box strong,.msg p,.mres b,textarea,input,.phone,#dlgDetail h2,[data-nt],script,style,.leaflet-container,.leaflet-popup-content b';
  var ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];
  var store = new WeakMap();       // text node -> { en, ne }
  var astore = new WeakMap();      // element -> { attr: { en, ne } }
  var mo = null, busy = false;

  function skipped(node) {
    var el = node.nodeType === 1 ? node : node.parentElement;
    if (!el) return true;
    return !!(el.closest && el.closest(SKIP));
  }
  function doText(n) {
    if (n.nodeType !== 3) return;
    var cur = n.nodeValue, rec = store.get(n);
    if (rec && cur === rec.ne) return;
    if (!/[A-Za-z]/.test(cur) || skipped(n)) return;
    var loose = !!(n.parentElement && n.parentElement.closest('.fmeta,.nkm,.fprice,#budgetText,.hint,.price-big,.card-price,.fprice,.nprice,.cfacts,.badge,.facts,.pcount,.about-box,.mres,#countLine,.chip,.tagx'));
    var out = translate(cur, loose);
    if (out !== cur) { store.set(n, { en: cur, ne: out }); busy = true; n.nodeValue = out; busy = false; }
  }
  function doAttrs(el) {
    if (el.nodeType !== 1) return;
    ATTRS.forEach(function (a) {
      var v = el.getAttribute(a);
      if (!v || !/[A-Za-z]/.test(v)) return;
      var rec = astore.get(el) || {}, r = rec[a];
      if (r && v === r.ne) return;
      var hit = D[v.trim()];
      if (hit == null) return;
      rec[a] = { en: v, ne: hit }; astore.set(el, rec);
      busy = true; el.setAttribute(a, hit); busy = false;
    });
  }
  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { doText(root); return; }
    if (root.nodeType !== 1) return;
    var tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    var n, list = [];
    while ((n = tw.nextNode())) list.push(n);
    list.forEach(doText);
    doAttrs(root);
    var els = root.querySelectorAll('[placeholder],[aria-label],[title],[alt]');
    for (var i = 0; i < els.length; i++) doAttrs(els[i]);
  }
  function restore() {
    busy = true;
    var tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT), n, list = [];
    while ((n = tw.nextNode())) list.push(n);
    list.forEach(function (t) { var r = store.get(t); if (r && t.nodeValue === r.ne) t.nodeValue = r.en; store.delete(t); });
    document.querySelectorAll('[placeholder],[aria-label],[title],[alt]').forEach(function (el) {
      var rec = astore.get(el); if (!rec) return;
      Object.keys(rec).forEach(function (a) { if (el.getAttribute(a) === rec[a].ne) el.setAttribute(a, rec[a].en); });
      astore.delete(el);
    });
    busy = false;
  }
  function start() {
    if (mo) return;
    mo = new MutationObserver(function (list) {
      if (busy || lang !== 'ne') return;
      list.forEach(function (m) {
        if (m.type === 'characterData') doText(m.target);
        else if (m.type === 'attributes') doAttrs(m.target);
        else m.addedNodes.forEach(function (x) { walk(x); });
      });
    });
    mo.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }

  var listeners = [];
  function apply() {
    document.documentElement.lang = lang === 'ne' ? 'ne' : 'en';
    document.documentElement.classList.toggle('is-ne', lang === 'ne');
    if (lang === 'ne') { walk(document.body); start(); } else restore();
    document.querySelectorAll('[data-lang]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.lang === lang)); });
  }
  function set(l) {
    l = l === 'ne' ? 'ne' : 'en';
    if (l === lang) return;
    lang = l;
    try { localStorage.setItem(KEY, l); } catch (e) {}
    apply();
    listeners.forEach(function (f) { try { f(l); } catch (e) { console.error(e); } });
  }

  window.GJ = {
    lang: function () { return lang; },
    set: set,
    // Pick the right sentence for the language in use.
    L: function (en, ne) { return lang === 'ne' ? ne : en; },
    // Turn English text into Nepali on demand (used for text that is not drawn on the page).
    t: function (s) { return lang === 'ne' ? translate(String(s), true) : String(s); },
    money: money,
    onChange: function (f) { listeners.push(f); },
    // Called once the page is drawn, and again after big redraws.
    refresh: function () { if (lang === 'ne') walk(document.body); },
    apply: apply
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply); else apply();
})();
