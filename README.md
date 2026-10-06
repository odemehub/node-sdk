# ödemehub Node.js SDK

ödemehub ödeme geçidini kendi uygulamanızdan kullanmak için hazırlanmış Node.js istemcisi. Kart çekmek, 3D ödeme başlatmak, sipariş, abonelik ve ödeme linki açmak, kart saklamak, iade ve iptal yapmak, taksit sormak: hepsi burada.

İstemci her isteği gizli anahtarınızla imzalar, gelen her yanıtın imzasını doğrular. Siz imza, başlık ya da JSON ayrıntılarıyla uğraşmazsınız. Her uç nokta için bir metot vardır ve adı uç noktanın adıdır: `create-order` için `createOrder()`, `retrieve-saved-cards` için `retrieveSavedCards()`. TypeScript tipleri pakettedir; çalışma zamanı bağımlılığı yoktur.

## Kurulum

Node.js 18 ve üzeri gerekir.

```bash
npm install @odemehub/node-sdk
```

## Yapılandırma

Üç bilgi gerekir. Hepsi paneldeki **Entegrasyon** sayfasındadır: Çalışma Alanı Kimliğiniz, API anahtarı ve gizli anahtar.

```ts
import { Client } from '@odemehub/node-sdk';

const client = new Client({
    baseUrl: 'https://app.odemehub.com',
    team: '1000000001',                                  // Çalışma Alanı Kimliği
    apiKey: process.env.ODEMEHUB_API_KEY!,
    apiSecret: process.env.ODEMEHUB_API_SECRET!,
});
```

Gizli anahtar hiçbir zaman tel üzerinden gitmez; yalnızca imza üretmekte ve doğrulamakta kullanılır. Anahtarları kodun içine yazmayın, ortam değişkeninde tutun.

Geçit hiçbir yerde veritabanı numarası kullanmaz: ödeme hesabı, işlem, sipariş, abonelik, link, link ödemesi ve kayıtlı kart her zaman token'ıyla anılır.

İstek bir dakika içinde yanıt almazsa kesilir; süreyi `timeout` (milisaniye) ile değiştirebilirsiniz. İstekler Node'un kendi `fetch`'iyle gider; kendi `fetch`'inizi `fetch` seçeneğiyle verebilirsiniz.

Bütün metotlar `Promise` döner. İstekler düz nesnedir; isteğe bağlı bir alanı vermezseniz gövdeye hiç yazılmaz. İstemci alanları kendisi denetlemez; her alanı geçit denetler ve reddettiğini alan alan `ValidationError` ile söyler.

## İmza

Her istek üç başlıkla gider: `X-Api-Key`, `X-Timestamp` (Unix saniye) ve `X-Signature`. İmza, `"{timestamp}\n{METHOD}\n{path}\n{body}"` metni üzerinden gizli anahtarla alınan HMAC-SHA256'nın küçük harfli hex hâlidir. `path` adresin sorgu dizesiz yolu (`/api/1000000001/gateway/regular-payment`), `body` gönderilen JSON'ın kendisidir. Bütün uç noktalar POST'tur. Zaman damgası sunucu saatinden 5 dakikadan uzak olamaz. Geçit her yanıtı aynı yöntemle imzalar; istemci yanıtı isteğin metodu ve yoluyla, yanıtın kendi `X-Timestamp` değeriyle doğrular.

```ts
import { createHmac } from 'node:crypto';

createHmac('sha256', apiSecret)
    .update(`${timestamp}\n${method}\n${path}\n${body}`)
    .digest('hex');
```

Test vektörü: `secret_test` anahtarıyla, `1700000000` anında, `/api/1000000001/gateway/regular-payment` yoluna `POST` edilen `{"a":1}` gövdesinin imzası `4d6225c9dd46837418b40dd8140d76a24cd7520d81ff3b280bf98da8da6a8771`'dir. Aynı hesap `Signature` sınıfında da vardır (`signMessage()`, `verifyMessage()`).

## Karttan doğrudan çekim

Müşteriyi bankasına göndermeden çekim yapar. Başarılı yanıt, paranın alındığı anlamına gelir.

```ts
const customer = {
    reference: 'musteri-88',                 // sizdeki müşteri anahtarı; kart saklamak için gerekir
    billingAddress: {
        firstname: 'Ahmet',
        lastname: 'Yılmaz',
        email: 'ahmet@ornek.com',
        phone: '05551112233',
        address: 'Kızılırmak Mah. Dumlupınar Blv. No:3',
        district: 'Çankaya',
        province: 'Ankara',
        country: 'TR',
        // şirket adına alışverişte üçü birlikte: companyTitle, taxNumber, taxOffice
    },
};

const card = {
    holderName: 'AHMET YILMAZ',
    number: '5400 3600 0000 0003',           // boşluklu ya da boşluksuz
    expiryMonth: '12',
    expiryYear: '2030',
    securityCode: '000',
    shouldSave: true,                        // isteğe bağlı: başarılı ödemeden sonra kartı sakla
};

const payment = await client.regularPayment({
    reference: 'SIP-10231',           // sizdeki referans; en az bir rakam içermeli
    amount: '450.00',
    installmentNumber: 1,
    ip: req.ip,
    customer,
    card,
});

if (payment.result.successful) {
    payment.transaction.token;               // iade ve iptalde ödeme bununla adlandırılır
    payment.transaction.paymentStatus;       // paid
    payment.savedCard?.token;                // shouldSave gönderildiyse ve kart saklandıysa
}
```

Reddedilen ödeme de bir sonuçtur: `result.successful` false, `result.message` neden. Yalnızca geçit isteğin kendisini reddederse (hatalı alan, yetki, hız sınırı, bulunamayan kayıt) hata fırlatılır.

Ödeme yanıtı (`Response.Payment`) ödemeyi bütünüyle taşır: `transaction` altında `token`, `reference`, `status`, `paymentStatus`, `securityType`, `amount`, `baseAmount`, `currency`, `installmentNumber`, `isTest`, `createdAt`, ödeme bir siparişte, linkte ya da abonelikte alındıysa `orderToken` / `paymentLinkToken` / `subscriptionToken` (linkte alınan ödemede `paymentLinkToken` ile birlikte link ödemesinin `linkPaymentToken`'ı da dolu gelir); yanında ödemenin dondurduğu `customer` (`reference`, `billingAddress`), `conversion` ve kart saklandıysa `savedCard`.

Kayıtlı kartla ödemede `card` yerine `savedCardToken` verilir; ödeme kartın saklandığı hesaptan geçer, `paymentProviderToken` gönderilmez. Kart hangi müşteri referansıyla saklandıysa ödeme de aynı referansı taşımalıdır.

**Müşteriler.** `customer.reference` gönderdiğiniz ödeme başarılı olunca geçit müşteriyi o referansla çalışma alanınızın müşteri listesine yazar ya da günceller; başarısız ödeme müşteriye dokunmaz. Referans göndermezseniz ödeme yine alınır ama müşteri kaydedilmez ve kart saklanamaz. Saklanan kart müşteriye bağlanır; müşterinin son ödeme yaptığı kart varsayılan kartı olur.

Tutarlar nokta ayraçlı ve en çok iki ondalıklı metindir: `'100'`, `'100.1'`, `'100.10'`. İmzalanıp gönderildiği gibi kalır, yolda yuvarlanmaz. Para birimi (`'TRY'`, `'USD'`, `'EUR'`, `'GBP'`) boş bırakılırsa TRY'dir. Taksit yalnızca TRY'de 1'den büyük olabilir.

## 3D ödeme

Siz ödemeyi başlatırsınız, müşteri bankasına gider, banka müşteriyi sizin adresinize geri yollar.

```ts
const payment = await client.securePayment({
    reference: 'SIP-10232',
    amount: '450.00',
    installmentNumber: 1,
    ip: req.ip,
    callbackUrl: 'https://magazam.com/odeme/donus',
    customer,
    card,
});

if (payment.redirectUrl !== null) {
    res.redirect(payment.redirectUrl);                  // müşteriyi bankaya gönderin
}
```

Başarılı yanıt **ödeme alındı demek değildir**; müşterinin gideceği adres hazır demektir. Adres 15 dakika geçerlidir; süresinde açılmayan ödeme `expired` olur.

Banka işini bitirince müşterinin tarayıcısı `callbackUrl` adresinize şu alanları POST eder: `transaction_token`, `reference`, `successful` (`1`/`0`). Bu POST imzasızdır ve müşterinin tarayıcısından gelir; yalnızca ipucudur. Sonucu kendi imzalı bağlantınızdan sorun:

```ts
app.post('/odeme/donus', express.urlencoded({ extended: false }), async (req, res) => {
    const [payment] = (await client.retrievePayments({ token: req.body.transaction_token })).payments;

    if (payment?.isSuccessful()) {
        // siparişi ödendi olarak işaretleyin
    }
});
```

Başka bir çalışma alanının ya da var olmayan bir işlemin token'ını sorarsanız liste boş döner.

## Sipariş

Kart sizde sorulmaz. Siparişi açarsınız, geçit kendi ödeme sayfasının adresini döner, müşteri orada öder. Tutar gönderilmez: geçit kalemleri ve ödeyenin panelinizdeki listeden seçtiği gönderim yöntemini toplar. Birim tutarlar KDV dahildir.

```ts
const created = await client.createOrder({
    reference: 'SIP-10233',
    successUrl: 'https://magazam.com/odeme/donus',
    items: [
        { name: 'Kulaklık', unitAmount: '1200.00', quantity: 1, taxRate: '20', reference: 'SKU-1', saveAsProduct: true },
    ],
    customer: {                               // bilinen kadarı; kalanı sayfada sorulur. Hiç verilmeyebilir.
        reference: 'musteri-88',
        billingAddress: { firstname: 'Ahmet', email: 'ahmet@ornek.com' },
    },
    requiresShipping: true,                   // ödeyen adresini ve gönderim yöntemini sayfada seçer
    cancelUrl: 'https://magazam.com/sepet',
});

res.redirect(created.order.checkoutUrl!);     // müşteriyi buraya gönderin
created.order.amount;                         // geçidin hesapladığı toplam
```

`saveAsProduct: true` olan kalem referansıyla ürün listenize yazılır (referans zorunlu). Gönderim yöntemleri istekte gönderilmez: panelinizdeki **Gönderim Yöntemleri** listesinden ödeyenin adresine uyanlar sunulur.

Referans tekil değildir: `createOrder()` her çağrıda yeni bir sipariş ve yeni bir token açar, aynı referans daha önce gönderilmiş olsa da. Var olan sipariş yeniden yazılmaz, tekrarlanan referans reddedilmez. Her yanıttaki `order.token`'ı saklayın; siparişi bundan sonra o adlandırır (`retrieveOrders({ token })`, `updateOrder({ token })`). Referansla sorgu o referanstaki bütün siparişleri getirir.

Sipariş (`Response.Order`): `token`, `reference`, `description`, `paymentProviderToken`, `status` (`open` / `paid`), `items[]`, `shippingMethod` (seçilen), `subtotal`, `shippingAmount`, `taxAmount`, `amount`, `discount`, `currency`, `isTest`, `createdAt`, `checkoutUrl` (ödenebilirken dolu), `transaction` (ödeyen işlem, açıkken `null`) ve `customer` (`reference`, `billingAddress`, `shippingAddress`).

**Kupon.** API'de kupon alanı yoktur; ödeyen kodu ödeme sayfasında girer. Kupon kullanılan siparişte `discount` (`code`, `amount`) dolu gelir, kullanılmayanda `null`. Siparişin `subtotal`, `taxAmount` ve `amount` değerleri indirim düşülmüş hâlidir; kupon gönderim ücretinden düşülmez.

Ödendiğinde müşteri `successUrl` adresinize 3D dönüşüyle aynı alanlarla POST edilir; `retrieveOrders()` kesin sonucu verir.

```ts
const [order] = (await client.retrieveOrders({ token })).orders;

order.isPaid();
order.transaction?.token;                     // iade / iptal / retrievePayments için
order.customer?.reference;                    // referanssız açılan siparişte null

// Açık siparişte yalnızca gönderilen alanlar değişir; kalemler gönderilirse tamamı yenilenir.
// null gönderilen alan boşaltılır.
await client.updateOrder({ token, description: 'Hediye paketi', cancelUrl: null });
```

Ödenmiş sipariş değiştirilemez.

## Ödeme linki

Herkesin tekrar tekrar ödeyebildiği bir sayfa. Müşteri bilgisi gönderilmez; ödeyen sayfada kendisi yazar.

```ts
const created = await client.createPaymentLink({
    items: [{ name: 'Bağış', unitAmount: '100.00', quantity: 1, taxRate: '0' }],
    currency: 'TRY',
    reference: 'LNK-1',                       // boş: geçit LINK{n} üretir
    expiresAt: '2026-12-31',                  // çalışma alanının saat dilimine göre gün
    emailsPayer: true,                        // ödeme tamamlanınca ödeyene e-posta gider; varsayılan false
});

created.paymentLink.token;                    // linki bundan sonra bu adlandırır; saklayın
created.paymentLink.checkoutUrl;              // linkin kendisi; ödenemezken (kapalı, süresi geçmiş) null
created.paymentLink.expiresAt;                // verilen günün sonu, ISO 8601 UTC
created.paymentLink.isTest;                   // ödemeleri şu an test ortamında mı alınıyor

const [detail] = (await client.retrievePaymentLinks({ token: created.paymentLink.token })).paymentLinks;
detail.transactions;                          // son 50 deneme, yeniden eskiye
detail.transactionsCount;                     // linkteki denemelerin tamamının sayısı
detail.successful();                          // listelenenlerden başarılı olanlar

await client.updatePaymentLink({ token: created.paymentLink.token, isActive: false });
```

`createPaymentLink()` her çağrıda yeni bir link ve yeni bir token açar, aynı referans daha önce gönderilmiş olsa da; var olan link yeniden yazılmaz. Linki değiştirmek için yanıttaki token'la `updatePaymentLink()` çağırın.

**Tutar tipi.** `amountType` ödeyenin ne ödediğini belirler (`AmountType`):

| Değer | Ödeyen ne öder |
| --- | --- |
| `fixed` (varsayılan) | Sizin yazdığınız kalemleri (`items` zorunlu) |
| `custom` | Kendi yazdığı tutarı |
| `predefined` | `predefinedAmounts` içinden seçtiği tutarı |
| `predefined_and_custom` | Hazır tutarlardan birini ya da kendi yazdığını |

Seçimli tiplerde `items` gönderilmez (gönderilirse yok sayılır); ödeme `itemName` adlı tek kalem olarak alınır ve `itemName` zorunludur. `predefinedAmounts` en çok 10 tutardır ve hazır tutarlı tiplerde zorunludur. `taxRate` ödeyenin seçtiği tutarın KDV oranıdır; `taxMode` (`TaxMode`) oranın tutarın içinde mi (`inclusive`, varsayılan: 100 ödenir, 83,33 + 16,67 KDV) üstüne mi (`exclusive`: 100 yazılır, 120 çekilir) olduğunu söyler.

**Para birimi seçimi.** `currencyType: 'selectable'` (`CurrencyType`) ile ödeyen para birimini sayfada seçer; seçebileceği diğer para birimlerini `currencies` ile verirsiniz (zorunlu). `currency` her zaman listeye girer ve sayfanın ilk para birimidir. Varsayılan `fixed`'de link yalnız `currency` ile ödenir.

```ts
const donation = await client.createPaymentLink({
    amountType: 'predefined_and_custom',
    itemName: 'Bağış',
    predefinedAmounts: ['50.00', '100.00', '250.00'],
    taxRate: '0',
    currency: 'TRY',
    currencyType: 'selectable',
    currencies: ['USD', 'EUR'],
});

donation.paymentLink.amount;                  // seçimli tipte null; subtotal ve taxAmount da null
donation.paymentLink.currencies;              // ['TRY', 'USD', 'EUR']
```

Güncellemede `null` gönderilen alan boşaltılır; `itemName`, `predefinedAmounts`, `taxRate` ve `currencies` de böyle boşaltılabilir. Tipin kullanmadığı alanları geçit kaydederken bırakır. Seçimli tipten `fixed`'e dönen (ya da `fixed`'de kalıp kalemi olmayan) link kalemlerini göndermek zorundadır.

Link (`Response.PaymentLink`): `token`, `reference`, `description`, `paymentProviderToken`, `amountType`, `itemName`, `predefinedAmounts`, `taxRate`, `taxMode`, `items[]`, `subtotal`, `taxAmount`, `amount` (son üçü seçimli tipte `null`), `currency`, `currencyType`, `currencies` (`fixed`'de `null`), `emailsPayer`, `isActive`, `isTest`, `expiresAt`, `checkoutUrl`, `createdAt`; sorguda ayrıca `transactions` ve `transactionsCount`.

**Link ödemeleri.** Linkte yapılan her ödeme bir link ödemesidir (`LinkPayment`): ödeyen ödemeye başlayınca `LINKPAY{n}` referansıyla açılır, ödeme geçince `paid` olur. Link ödemesini ödeyen açar, siz yalnız sorarsınız:

```ts
const [linkPayment] = (await client.retrieveLinkPayments({ reference: 'LINKPAY1' })).linkPayments;

linkPayment.status;                           // open | paid
linkPayment.isPaid();
linkPayment.paymentLink;                      // { token, reference }
linkPayment.items;                            // ödendiği andaki kalemler
linkPayment.amount;                           // ödenen tutar, kupon düşülmüş
linkPayment.discount;                         // { code, amount } ya da null
linkPayment.customer?.billingAddress;         // ödeyenin sayfada yazdığı fatura adresi
linkPayment.transaction?.token;               // ödeyen işlem; iade / iptal / retrievePayments için
```

Link ödemesi (`Response.LinkPayment`): `token`, `reference`, `paymentLink` (`token`, `reference`), `paymentProviderToken`, `status`, `items[]`, `subtotal`, `taxAmount`, `amount`, `discount`, `currency`, `customer` (`billingAddress`; ödeyen yazmadıysa `null`), `isTest`, `createdAt`, `transaction` (`token`, `reference`, `paymentStatus`; açıkken `null`).

Panelden açtığınız linkler de aynı uçlarla bulunur. Linkle ödeyen kişi müşteri listenize yazılmaz ve kartı saklanmaz. Süresi geçmiş link yeni bir `expiresAt` verilince yeniden ödeme alır; yeni tarih olmadan `isActive: true` reddedilir.

## Abonelik

İlk yenileme ödeme sayfasında ödenir ve kart orada müşteriye saklanır; sonrakiler müşterinin varsayılan kartından çekilir. Müşteri referansı zorunludur. Ödeme hesabı kart saklamalı ve 3D ödeme almalıdır.

```ts
const created = await client.createSubscription({
    reference: 'ABO-1',
    period: 'monthly',                        // daily | weekly | monthly | annually
    successUrl: 'https://magazam.com/abonelik/donus',
    items: [{ name: 'Premium', unitAmount: '99.90', quantity: 1, taxRate: '20' }],
    customer: { reference: 'musteri-88' },
    renewalLimit: 12,                         // boş: iptale kadar
});

res.redirect(created.subscription.checkoutUrl!);

const [subscription] = (await client.retrieveSubscriptions({ token })).subscriptions;
subscription.status;                          // pending | active | past_due | cancelled | completed
subscription.renewal.paidAt;                  // içinde bulunulan yenileme
subscription.nextPaymentAt;
subscription.renewalsPaid;
subscription.customer?.reference;

// Dönem, kalemler, ödeme sayısı değişir; iptal de buradan:
await client.updateSubscription({ token, status: 'cancelled' });
```

`createSubscription()` de her çağrıda yeni bir abonelik ve yeni bir token açar, aynı referans daha önce gönderilmiş olsa da; var olan abonelik yeniden yazılmaz. Yanıttaki `subscription.token`'ı saklayın.

Ödeyen ilk ödemede ödeme sayfasında kupon kullandıysa `subscription.discount` (`code`, `amount`) dolu gelir, kullanmadıysa `null`; kupon yalnız ilk ödemede geçerlidir. Aboneliğin kendi `subtotal`, `taxAmount` ve `amount` değerleri indirimsizdir; ilk ödemede çekilen indirimli tutar `renewal.amount`'tadır.

İptalde para iade edilmez; ödenmiş dönem sonuna kadar sürer, sonra abonelik biter. Ödenmiş dönem yoksa hemen `cancelled` olur.

İlk ödemeden sonra yalnızca iptal (`status`), ödeme sayısı (`renewalLimit`), dönem (`period`) ve aynı kalemlerin birim fiyatı değişebilir; müşteri dahil başka bir alan gönderilirse geçit `ValidationError` ile reddeder. `renewalLimit` şimdiye kadar ödenen yenileme sayısının altına inemez; `renewalLimit: null` aboneliği iptale kadar sürdürür.

## Kayıtlı kartlar

Kart ödeme sırasında (`shouldSave: true`) ya da ödemesiz saklanır; ikisinde de `customer.reference` zorunludur. Kart o müşteriye bağlanır ve müşteri referansıyla bulunur; kart yanıtlarındaki `customer` yalnızca `reference` taşır. Ödemesiz saklamada müşteri, sağlayıcı kartı kabul edince gönderdiğiniz bilgilerle listenize yazılır.

```ts
const saved = await client.createSavedCard({ customer, card });   // customer.reference ve tam fatura adresi zorunlu
saved.savedCard?.token;                       // sağlayıcı saklamadıysa null, nedeni result.message

const cards = await client.retrieveSavedCards({ customerReference: 'musteri-88' });
cards.savedCards;                             // varsayılan kart önce
cards.default();                              // varsayılan kart ya da null

const [one] = (await client.retrieveSavedCards({ token: cardToken })).savedCards;

await client.updateSavedCard({ token: cardToken });   // varsayılan yap
await client.deleteSavedCard({ token: cardToken });
```

Kart saklamada güvenlik kodu, gerçek kart deposu olmayan sağlayıcılarda gerekir (kart küçük bir tutarla doğrulanıp hemen iade edilir); kart deposu olanlarda gönderilmeyebilir. Güvenlik kodu hiçbir yerde saklanmaz.

Kartı başka bir kartı varsayılan yaparak varsayılanlıktan çıkarırsınız. Silme önce sağlayıcıda yapılır; sağlayıcı bırakmazsa kart kalır ve `result.message` nedenini söyler.

## İade ve iptal

```ts
// Gün sonu almamış ödemenin tamamını geri alır
const cancel = await client.cancelPayment({ token: transactionToken });

// Tutar verilirse kısmi, verilmezse kalanın tamamı iade edilir.
// Kur çevirisiyle çekilen ödemede tutar çekilen para birimindedir.
const refund = await client.refundPayment({ token: transactionToken, amount: '50.00' });
refund.refund?.amount;                        // gerçekten geri giden tutar
refund.transaction.paymentStatus;             // partially_refunded
```

## Kart sorgusu ve taksitler

Kartın ilk 6–8 hanesiyle bankası, tipi ve tutara göre taksit seçenekleri. Hiçbir şey çekilmez.

```ts
const bin = await client.retrieveBin({ bin: '54003600', amount: '450.00' });

if (bin.result.successful) {
    bin.issuerName;     // Garanti Bankası
    bin.program;        // Bonus
    bin.scheme;         // mastercard
    bin.type;           // credit
    bin.isCommercial;

    for (const installment of bin.installments) {
        console.log(`${installment.number} x ${installment.amount} = ${installment.total}`);
    }
}
```

Sorgu başarısız dönebilir: kart tanınmıyor olabilir ya da hesabınızın sağlayıcısı taksit vermiyor olabilir. İki durumda da satışı durdurmayın, tek çekimle devam edin. TRY dışındaki para birimlerinde taksit listesi boş döner.

Taksitli satışta `retrieveBin` size o taksidin toplamını verir; onu `amount`, sattığınız tutarı `baseAmount` olarak gönderin:

```ts
await client.regularPayment({
    reference: 'SIP-10234',
    amount: '473.60',        // 3 taksitin toplamı
    baseAmount: '450.00',    // satılan tutar
    installmentNumber: 3,
    // ...
});
```

## Ödeme hangi hesaptan geçer

`paymentProviderToken` verirseniz ödeme o hesaptan geçer; sipariş, abonelik ve linkte de aynı alan vardır. Vermezseniz hesabı çalışma alanınız seçer: panelde **Ödeme Ayarları → Gate (Yönlendirme)** altındaki kurallar sırayla denenir ve ödemenin karşıladığı ilk kural hesabı belirler. Hiçbir kural tutmazsa ödeme varsayılan hesaptan geçer. Kayıtlı kartla ödeme her zaman kartın saklandığı hesaptan geçer. Taksitleri `retrieveBin()` ile gösteriyorsanız orada da hesap vermeyin: taksitler ödemenin gideceği hesaptan gelir.

## Kur çevirisi

Panelde **Ödeme Ayarları → Kur Çevirici** altında bir kural tanımladıysanız, o para biriminde gelen ödeme karttan kuralın para biriminde çekilir. İsteğinizde hiçbir şey değişmez; yanıttaki `conversion` karttan ne çekildiğini söyler (`amount`, `currency`, `rate`). Çevrilmeyen ödemede `conversion` `null` gelir. İade tutarını çekilen para biriminde gönderin.

## Sorgulama

Her kaynak tek bir `retrieve-*` ucuyla sorulur ve yanıt her zaman bir listedir (eskiden yeniye); eşleşen yoksa boş liste döner. Kayıt üç yoldan biriyle adlandırılır: `token`, sizdeki `reference` ya da açıldığı günler (`createdFrom` / `createdTo`). Aralık en çok 7 gündür ve çalışma alanının saat dilimindedir; hiçbiri verilmezse son 7 gün.

```ts
// Yanıtı alınamayan bir ödemenin akıbeti: referanstaki bütün denemeler
await client.retrievePayments({ reference: 'SIP-10231' });

// Belli günlerdeki bütün denemeler, reddedilenler dahil, durumu ve tutarıyla
const list = await client.retrievePayments({ createdFrom: '2026-09-26', createdTo: '2026-10-02' });

for (const transaction of list.payments) {
    transaction.status;                       // started, redirected_to_secure_page, returned_from_secure_page, timeout, failed, expired, successful
    transaction.paymentStatus;                // unpaid, paid, cancelled, refunded, partially_refunded
    transaction.errorMessage;
    transaction.orderToken ?? transaction.paymentLinkToken ?? transaction.subscriptionToken;
    transaction.linkPaymentToken;             // linkte alınan denemede link ödemesi
}

list.successful();                            // geçen denemeler

await client.retrieveOrders({ reference: 'SIP-10233' });
await client.retrieveOrders();                                 // son 7 gün
await client.retrieveSubscriptions({ reference: 'ABO-1' });
await client.retrievePaymentLinks({ createdFrom: '2026-09-26', createdTo: '2026-10-02' });
await client.retrieveLinkPayments({ reference: 'LINKPAY1' });   // link ödemesinin referansı geçidin verdiği LINKPAY{n}
await client.retrieveSavedCards({ customerReference: 'musteri-88' });
```

Referans tekil olmadığından `reference` ile sorgu birden çok kayıt dönebilir; tek bir kaydı `token` ile sorun. Linkte alınan bir denemenin `reference`'ı link ödemesinin `LINKPAY{n}` referansıdır; linkin kendi referansıyla `retrievePayments` denemeleri getirmez, linkin denemeleri `retrievePaymentLinks` yanıtındaki `transactions`'ta ya da `retrieveLinkPayments` ile bulunur.

## Webhook

Sipariş ödendiğinde, link ödemesi alındığında, abonelik durum değiştirdiğinde, API ödemesi bittiğinde ve bir ödeme iade ya da iptal edildiğinde geçit imzalı JSON POST eder. Adresler kodda verilmez; panelde **Ayarlar → Webhook** sayfasında olay ve adres seçilerek tanımlanır.

| Kaynak | Olaylar |
| --- | --- |
| Sipariş | `order.paid`, `order.payment_refunded`, `order.payment_cancelled` |
| Ödeme linki | `payment_link.paid`, `payment_link.payment_refunded`, `payment_link.payment_cancelled` |
| Abonelik | `subscription.active`, `subscription.past_due`, `subscription.cancelled`, `subscription.ended`, `subscription.completed`, `subscription.payment_refunded`, `subscription.payment_cancelled` |
| API ödemesi | `transaction.successful`, `transaction.failed`, `transaction.expired`, `transaction.payment_refunded`, `transaction.payment_cancelled` |

Sipariş, link ya da abonelikte alınan ödeme için `transaction.*` gelmez; o kaynağın kendi olayı gelir.

**Webhook nihai sonuç değildir.** Gövde yalnızca kaynağın token'ını (para hareketi varsa yanında ödemenin token'ını, `payment_link.*` olaylarında link ödemesinin token'ını) taşır; `discount` gibi ayrıntılar gövdede yoktur. Kararı, token ile geçide sorduğunuz yanıta göre verin ve yanıtı kendi kaydınızla (referans, tutar, durum) karşılaştırın. Gövdeyi **ham** okuyun; `express.json()` gibi gövdeyi ayrıştırıp yeniden yazan bir ara katman imzayı bozar.

```ts
import express from 'express';
import { SignatureError } from '@odemehub/node-sdk';

app.post('/odemehub/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    let webhook;

    try {
        webhook = client.webhook(req.method, req.path, req.body, req.get('X-Timestamp'), req.get('X-Signature'));
    } catch (error) {
        if (error instanceof SignatureError) {
            return res.sendStatus(401);
        }

        throw error;
    }

    webhook.id;      // aynı bildirim tekrar gelebilir; bununla ayıklayın
    webhook.event;   // 'order.paid', 'subscription.active' ...

    if (webhook.orderToken !== null) {
        const [order] = (await client.retrieveOrders({ token: webhook.orderToken })).orders;
        order.status;                        // 'paid'
        order.transaction?.paymentStatus;    // 'refunded', 'partially_refunded' ...
    } else if (webhook.linkPaymentToken !== null) {   // payment_link.*; paymentLinkToken da dolu
        const [linkPayment] = (await client.retrieveLinkPayments({ token: webhook.linkPaymentToken })).linkPayments;
        linkPayment.status;                  // 'paid'
        linkPayment.paymentLink.token;       // webhook.paymentLinkToken ile aynı
        linkPayment.transaction?.paymentStatus;
    } else if (webhook.subscriptionToken !== null) {
        const [subscription] = (await client.retrieveSubscriptions({ token: webhook.subscriptionToken })).subscriptions;
    } else if (webhook.transactionToken !== null) {   // transaction.*
        const [transaction] = (await client.retrievePayments({ token: webhook.transactionToken })).payments;
    }

    res.sendStatus(204);
});
```

Sipariş, link ve abonelikte para hareket eden olaylarda `transactionToken` da gelir; `payment_link.*` olaylarında ayrıca `linkPaymentToken`. `retrievePayments()` yanıtındaki `orderToken` / `paymentLinkToken` / `linkPaymentToken` / `subscriptionToken` ödemenin gerçekten o kaynağa ait olduğunu gösterir. Yalnızca doğrulamak için `client.verifyWebhook(...)` `boolean` döner. Geçit 2xx yanıt alana kadar 60 sn, 5 dk, 15 dk ve 30 dk arayla toplam 5 kez dener; yönlendirmeleri izlemez.

## Sabit değerler

Sabit değer kümeleri string-literal union tipleridir ve paketten dışa açılır: `Currency`, `Period`, `OrderStatus`, `SubscriptionStatus`, `LinkPaymentStatus`, `AmountType`, `CurrencyType`, `TaxMode`, `TransactionStatus`, `PaymentStatus`, `SecurityType`, `RefundType`, `RefundStatus`, `CardScheme`, `CardType`, `WebhookEvent`.

```ts
import type { SubscriptionStatus } from '@odemehub/node-sdk';

const status: SubscriptionStatus = 'past_due';
```

İsteklerde yalnız listelenen değerler kabul edilir. Yanıtlarda alanlar `Known<…>` tipindedir: geçit ileride yeni bir değer eklerse SDK çökmez, değeri olduğu gibi metin olarak verir.

## Hatalar

Bütün hatalar `OdemehubError`'dan türer; tek bir `instanceof` kontrolü hepsini yakalar.

| Hata | Durum | Anlamı |
| --- | --- | --- |
| `AuthenticationError` | 401 | API anahtarı yanlış, imza tutmuyor ya da zaman damgası aralık dışında |
| `ForbiddenError` | 403 | Çalışma alanı işlem yapamıyor (ödenmemiş bakiye, plan) ya da plan bu özelliği kapsamıyor |
| `NotFoundError` | 404 | Güncellenmek, silinmek, iade ya da iptal edilmek istenen kayıt yok (sorgularda boş liste döner) |
| `ValidationError` | 422 | Alan hataları; `error.errors` noktalı alan adıyla (`transaction.amount`, `order.items.0.name`) |
| `RateLimitError` | 429 | İstek sınırı; `error.retryAfter` saniye |
| `SignatureError` | — | Yanıtın ya da webhook'un imzası doğrulanamadı; içeriğe güvenmeyin |
| `TransportError` | — | Geçide ulaşılamadı; ödemenin akıbetini `retrievePayments({ reference })` ile sorun |
| `UnexpectedResponseError` | diğer | Okunamayan yanıt; `error.status` HTTP kodunu verir |

```ts
import { OdemehubError, ValidationError } from '@odemehub/node-sdk';

try {
    await client.regularPayment(payment);
} catch (error) {
    if (error instanceof ValidationError) {
        console.log(error.errors['transaction.amount']?.[0]);
    } else if (error instanceof OdemehubError) {
        console.log(error.message);   // Türkçe
    } else {
        throw error;
    }
}
```

Reddedilen ödeme, iade ya da kart saklama hata değildir; `result.successful` false ve `result.message` dolu döner. Ağ hatasında ödemeyi körlemesine tekrarlamayın: `TransportError` "olmadı" demek değil, "bilmiyorum" demektir.

## İstek sınırları

Sınırlar çalışma alanı başına ve dakikalıktır: bütün uçlar için toplam 300 istek; para hareket ettiren uçlar (`secure-payment`, `regular-payment`, `refund-payment`, `cancel-payment`, `create-saved-card`, `delete-saved-card`) için ayrıca 60 istek. Sınır aşılırsa `RateLimitError` fırlatılır; `retryAfter` saniye bekleyip yeniden deneyin.

## 1.0.2'deki değişiklikler

1.0.2, SDK'yı geçidin bugünkü API'sine eşitler. Eklenenler:

- **Link ödemeleri:** yeni `retrieveLinkPayments()` metodu (`token`, `LINKPAY{n}` referansı ya da `createdFrom` / `createdTo`), yeni `Response.LinkPayment` ve `Response.LinkPaymentList` modelleri, yeni `LinkPaymentStatus` (`open` | `paid`). `PaymentTransaction`, `Transaction` ve `Webhook` yeni `linkPaymentToken` alanını taşır.
- **Ödeme linkinin yeni alanları:** `createPaymentLink()` ve `updatePaymentLink()` `amountType`, `itemName`, `predefinedAmounts`, `taxRate`, `taxMode`, `currencyType`, `currencies` ve `emailsPayer` alır; `Response.PaymentLink` aynı alanları döner. Yeni sabitler: `AmountType`, `CurrencyType`, `TaxMode`. Güncellemede `itemName`, `predefinedAmounts`, `taxRate` ve `currencies` `null` ile boşaltılabilir.
- **Kupon:** `Order`, `Subscription` ve `LinkPayment` yanıtları `discount` (`Response.Discount`: `code`, `amount`; kupon yoksa `null`) taşır. Webhook gövdesinde `discount` yoktur.

Küçük kırıcı değişiklikler:

- **`create*` artık idempotent değil:** `createOrder()`, `createSubscription()` ve `createPaymentLink()` her çağrıda yeni kayıt ve yeni token açar, aynı `reference` daha önce gönderilmiş olsa da. Açık kayıt yeniden yazılmaz; tekrarlanan referans için `ValidationError` dönmez. Referans tekil değildir; her yanıttaki token'ı saklayıp kaydı onunla adlandırın. Yanıtı alınamayan bir çağrıyı tekrarlamak ikinci bir kayıt açar.
- **`CreatePaymentLink.items` isteğe bağlı:** yalnız `fixed` tipte gerekir; seçimli tiplerde gönderilmez.
- **`PaymentLink.subtotal`, `taxAmount` ve `amount` artık `string | null`:** seçimli tipte geçit `null` döner ve SDK onu `null` olarak verir (eskiden `''` okunuyordu).
- **Linkte alınan deneme:** işlemin `reference`'ı link ödemesinin `LINKPAY{n}` referansıdır; linkin kendi referansıyla `retrievePayments()` linkin denemelerini getirmez.

## 1.0.1'deki kırıcı değişiklikler

1.0.1, SDK'yı geçidin bugünkü API'sine taşır ve 1.0.0 koduyla uyumlu değildir. 1.0.0'dan geçerken dikkat edilecekler:

- **İmza:** İstekler ve yanıtlar artık `X-Timestamp` ile, `"{timestamp}\n{METHOD}\n{path}\n{body}"` üzerinden imzalanır. 1.0.0 istemcileri bugünkü geçitle konuşamaz.
- **Kaldırılan metotlar:** `orderPayment`, `subscriptionPayment`, `saveProduct`, `cancelSubscription`, `retrieveTransactions`, `saveCard`, `savedCards`, `defaultSavedCard`. Yerlerine `createOrder`, `createSubscription`, `updateSubscription({ status: 'cancelled' })`, `retrievePayments`, `createSavedCard`, `retrieveSavedCards`, `updateSavedCard` gelir. Ürün kataloğu yoktur; kalemler adı ve fiyatıyla gönderilir.
- **Yeni metotlar:** ödeme linki uçları, bütün güncelleme uçları ve her kaynakta tek `retrieve*` sorgusu.
- **Token parametresi:** Tek bir kaydı adlandıran istek alanı her yerde `token`'dır. `transactionToken`, `orderToken`, `subscriptionToken`, `paymentLinkToken` ve `savedCardToken` parametreleri kalktı.
- **Müşteri:** `customer.channelReference` yerine `customer.reference` gelir. Adres alanları `billingAddress` ve `shippingAddress` altındadır. Şirket bilgisi `tax` nesnesi yerine fatura adresindeki `companyTitle`, `taxNumber` ve `taxOffice` alanlarıdır.
- **Yanıtlar API JSON'unu birebir izler:** `payment.transaction.token`, `details.order.checkoutUrl`, `details.subscription.status`, `details.paymentLink.checkoutUrl` gibi. Düz `payment.transactionToken` ve `customerChannelReference` alanları kalktı. `OrderDetails` ve `SubscriptionDetails`, `customer`'ı hem üst seviyede hem varlığın üzerinde taşır.
- **Hatalar:** güncellenen, silinen, iade ya da iptal edilen kaydın token'ı bulunamazsa `NotFoundError` (404) atılır; eskiden bu durum 422 dönüyordu. Sorgular bulunamayan kayıtta boş liste döner. Yeni istisnalar: `ForbiddenError` (403), `NotFoundError` (404), `RateLimitError` (429, `retryAfter`).
- **Webhook:** `orderWebhook()`, `subscriptionWebhook()`, `transactionWebhook()` yerine tek `webhook(method, path, body, timestamp, signature)` (ve `verifyWebhook()`); imza istek ve yanıtlarla aynı şemadadır. Gövde yalnızca token taşır (`orderToken`, `paymentLinkToken`, `subscriptionToken`, `transactionToken`); durum `retrieve*()` ile sorulur. Adresler panelde tanımlandığı için `securePayment`, `createOrder`, `updateOrder`, `createSubscription`, `updateSubscription` artık `webhookUrl` almaz. `Signature`'ın yalnız gövdeyi imzalayan `sign()` / `verify()` metotları kalktı.
- **İstemci tarafı denetim yok:** Kart ile kayıtlı kartın birlikte verilmesi gibi durumları artık geçit `ValidationError` ile reddeder; SDK `TypeError` fırlatmaz.
- **Kanal kalktı.** `Options.channelToken` ve isteklerdeki `channelToken` yoktur. Referans alanları `channelReference` yerine `reference` adını taşır (ödeme, sipariş, abonelik, link, kalem); yanıtlarda `channelToken` yoktur. Geri dönüşte tarayıcı `channel_reference` değil `reference` POST eder.
- **Sorgular tek uçta.** Her kaynakta tek sorgu metodu vardır: `retrievePayments`, `retrieveOrders`, `retrieveSubscriptions`, `retrievePaymentLinks`, `retrieveSavedCards`. İstek `{ token }`, `{ reference }` (kartta `{ customerReference }`), `{ createdFrom, createdTo }` ya da boş nesnedir; yanıt her zaman listedir, bulunamayan kayıt `NotFoundError` değil boş listedir.
- **Gönderim:** sipariş ve abonelik `requiresShipping` ile ödeme sayfasında gönderim adresi ister; gönderim yöntemleri panelde tanımlanır, istekte gönderilmez. Yanıtta yalnızca ödeyenin seçtiği yöntem (`shippingMethod`: `reference`, `title`, `amount`, `taxRate`) gelir.
- **Kalemler:** `taxRate` isteğe bağlı; yeni `saveAsProduct`.
- **Müşteri:** referans gönderilmeyebilir; o zaman müşteri kaydedilmez ve kart saklanamaz. Abonelikte ve kart saklamada zorunludur. `reference` ve `billingAddress` `null` olabilir.
- **Ödeme linki:** son 50 deneme ve `transactionsCount` `retrievePaymentLinks` yanıtında her `PaymentLink` üzerindedir; `PaymentLinkDetails` yalnızca linki taşır.
- **Kayıtlı kart:** listede her kart kendi `customer`'ını taşır; `SavedCardList.customer` kalktı. Listelenen ödemede `savedCard`, kartın saklanması istendiyse saklanan kartı verir.

