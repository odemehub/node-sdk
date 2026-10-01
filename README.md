# ödemehub Node.js SDK

ödemehub ödeme geçidini kendi uygulamanızdan kullanmak için hazırlanmış Node.js istemcisi. Kart çekmek, 3D ödeme başlatmak, müşteriyi ödeme sayfasına yollamak, ürün kataloğunuzu eşlemek, abonelik açmak, kart saklamak, iade ve iptal yapmak ve bir kartın taksit seçeneklerini sormak için gereken her şey burada.

İstemci her isteği takımınızın gizli anahtarıyla imzalar, gelen her yanıtın imzasını doğrular. Siz imza, başlık ya da JSON ayrıntılarıyla uğraşmazsınız. TypeScript tipleri pakettedir; çalışma zamanı bağımlılığı yoktur.

## Kurulum

Node.js 18 ve üzeri gerekir.

```bash
npm install @odemehub/node-sdk
```

## Yapılandırma

Dört bilgiye ihtiyacınız var. Hepsi paneldeki **Entegrasyon** sayfasındadır (menünün en altında): API anahtarı, gizli anahtar, Çalışma Alanı Kimliğiniz ve kanallarınızla ödeme hesaplarınızın token'ları.

```ts
import { Client } from '@odemehub/node-sdk';

const client = new Client({
    baseUrl: 'https://app.odemehub.com',
    team: '4829301756',                                  // Çalışma Alanı Kimliğiniz
    channelToken: '6f1c2e7a-4b3d-4c8e-9a61-2f5d7b0c3e14', // müşterinin size ulaştığı kanal
    apiKey: process.env.ODEMEHUB_API_KEY!,
    apiSecret: process.env.ODEMEHUB_API_SECRET!,
});
```

Gizli anahtar hiçbir zaman tel üzerinden gitmez; yalnızca imza üretmekte kullanılır. Anahtarları kodun içine yazmayın, ortam değişkeninde tutun.

Kanal token'ı entegrasyonun tamamı için bir kez verilir. Birden çok kanalda satıyorsanız tek bir istekte `channelToken` vererek o isteği başka kanala yazdırabilirsiniz. Geçit hiçbir yerde veritabanı numarası kullanmaz: kanal, ödeme hesabı, işlem, kayıtlı kart, abonelik ve sipariş her zaman token'ıyla adlanır.

İstek bir dakika içinde yanıt almazsa kesilir; süreyi `timeout` (milisaniye) ile değiştirebilirsiniz. İstekler Node'un kendi `fetch`'iyle gider; kendi `fetch`'inizi `fetch` seçeneğiyle verebilirsiniz.

Bütün metotlar `Promise` döner. İstekler düz nesnedir; isteğe bağlı bir alanı vermezseniz gövdeye hiç yazılmaz.

## Karttan doğrudan çekim

Müşteriyi bankasına göndermeden çekim yapar. Başarılı yanıt, paranın alındığı anlamına gelir.

```ts
const payment = await client.regularPayment({
    channelReference: 'SIP-10231',          // işlemin sizdeki referansı
    amount: '450.00',
    installmentNumber: 1,
    ip: req.ip,
    customer: {
        channelReference: 'musteri-88',
        firstname: 'Ahmet',
        lastname: 'Yılmaz',
        email: 'ahmet@ornek.com',
        phone: '05551112233',
        address: 'Kızılırmak Mah. Dumlupınar Blv. No:3',
        district: 'Çankaya',
        province: 'Ankara',
        country: 'Türkiye',
    },
    card: {
        holderName: 'AHMET YILMAZ',
        number: '5400360000000003',
        expiryMonth: '12',
        expiryYear: '2030',
        securityCode: '000',
    },
});

if (payment.result.successful) {
    // payment.transactionToken — ödemenin geçitteki token'ı; iade ve iptalde bununla adlandırılır
}
```

Tutarlar her zaman metindir (`'450.00'`): imzalanıp gönderildiği gibi kalır, yolda yuvarlanmaz.

## 3D ödeme

3D'de çekim iki adımdır: siz ödemeyi başlatırsınız, müşteri bankasına gider, banka sonucu sizin adresinize gönderir.

```ts
const payment = await client.securePayment({
    channelReference: 'SIP-10232',
    amount: '450.00',
    installmentNumber: 1,
    ip: req.ip,
    callbackUrl: 'https://magazam.com/odeme/donus',
    customer,
    card,
});

if (payment.result.successful) {
    res.redirect(payment.redirectUrl!);   // müşteriyi bankaya gönderin
}
```

Başarılı yanıt **ödeme alındı demek değildir**; yalnızca müşterinin gideceği adres hazır demektir.

Müşteriyi **15 dakika içinde** bu adrese yönlendirin. Sayfası o süre içinde açılmayan ödemenin süresi dolar (`expired`). Süresi dolmuş bağlantıyı açan müşteri doğrudan `callbackUrl` adresinize, `successful=0` ile geri gönderilir; `retrievePayment()` sorgusu da başarısız sonucu ve nedenini döner.

Banka işini bitirince müşteri, tarayıcısı üzerinden `callbackUrl` adresinize döner. O POST (form gövdesi) **sonucu taşımaz**, yalnızca sonucun hazır olduğunu haber verir:

| Alan | Anlamı |
| --- | --- |
| `transaction_token` | ödemenin geçitteki token'ı |
| `channel_reference` | sizin kendi referansınız |
| `successful` | `1` / `0` — yalnızca ipucu, **güvenilmez** |

Sonucu kendi imzalı bağlantınızdan sorun:

```ts
app.post('/odeme/donus', express.urlencoded({ extended: false }), async (req, res) => {
    const outcome = await client.retrievePayment({
        transactionToken: req.body.transaction_token,
    });

    if (outcome.result.successful) {
        // siparişi ödendi olarak işaretleyin
    }
});
```

Neden böyle: o POST'u bizim sunucumuz değil, müşterinin tarayıcısı gönderir; tarayıcıya imzalayacak bir sır verilemez. `successful` alanına bakıp sipariş kapatmayın — onu herkes gönderebilir; yalnız "başarısız" ipucunda gereksiz sorgudan kaçınmak için kullanın. Geçide sorduğunuz yanıt ise her zaman imzalıdır ve SDK imzayı sizin için doğrular. Başkasının işlemini sorarsanız `ValidationError` alırsınız.

## Ürünler

Sipariş kalemleri ve abonelikler ürünleri **sizdeki referanslarıyla** adlandırır. Ürünü panelde (Ürünler sayfası) tanımlayabilir ya da kendi kataloğunuzdan geçide yazabilirsiniz:

```ts
const product = await client.saveProduct({
    channelReference: 'KAHVE-MAKINESI',
    name: 'Kahve makinesi',
    type: 'simple',          // simple | recurring
    amount: '450.00',
    taxRate: '20',           // fiyatın içindeki KDV oranı
    image: 'https://magazam.com/img/kahve-makinesi.jpg', // ödeme sayfasında gösterilir
});

await client.saveProduct({
    channelReference: 'PREMIUM-AYLIK',
    name: 'Premium üyelik',
    type: 'recurring',
    amount: '149.90',
    taxRate: '20',
    period: 'monthly',       // monthly | annually — yalnız recurring için zorunlu
});
```

Aynı kanalda aynı referans aynı üründür: tekrar gönderirseniz ikinci ürün açılmaz, mevcut olan güncellenir. `currency` verilmezse TRY, `isActive` verilmezse `true` kabul edilir. Ürün silinmez; `isActive: false` ile satışa kapatılır. `image` yalnızca `https://` adres alır; göndermezseniz ürün mevcut görselini (panelden yüklenmiş olanı da) korur, boş metin gönderirseniz görsel kaldırılır.

Ödeme istekleri ürünü hiçbir zaman değiştirmez; ürünün tek yazıldığı yer bu çağrı ve panel.

## Ödeme sayfası

Kart bilgisini hiç görmek istemiyorsanız sipariş açıp müşteriyi geçidin kendi sayfasına yollayabilirsiniz.

```ts
const order = await client.orderPayment({
    channelReference: 'SIPARIS-10233',
    successUrl: 'https://magazam.com/tesekkurler',
    cancelUrl: 'https://magazam.com/sepet',
    customer,
    items: [
        { channelReference: 'KAHVE-MAKINESI' },
        { channelReference: 'KAHVE-500G', quantity: 2, unitAmount: '180.00' },
        { channelReference: 'HEDIYE-PAKETI', name: 'Hediye paketi', unitAmount: '25.00', image: 'https://magazam.com/img/hediye-paketi.jpg' },
    ],
});

res.redirect(order.checkoutUrl);
```

Sipariş tutarını göndermezsiniz; geçit kalemleri toplar ve `order.amount` olarak döner. Bir kalemin boş bıraktığı ad, fiyat ve KDV oranı kayıtlı üründen gelir; kalemde verdiğiniz değerler yalnızca o sipariş için geçerlidir, ürünü değiştirmez. Kayıtlı olmayan bir referansla da kalem gönderebilirsiniz, ama o zaman `name` ve `unitAmount` zorunludur. Kalemin `image` alanı (`https://` adres) ödeme sayfasında kalemin yanında gösterilir; verilmezse kayıtlı ürünün görseli kullanılır, ürün kayıtlı değilse kalem görselsiz görünür.

Ödeme tamamlanınca müşteri, 3D'dekiyle aynı biçimde `successUrl` adresinize döner: aynı üç alan gelir, sonucu yine `retrievePayment()` ile sorarsınız. Müşteri ödeme sayfasında karttan kaynaklı bir hata alırsa size dönmez, sayfada kalıp başka kartla dener.

## Abonelikler

Müşteriden dönem dönem tahsilat yapmak için abonelik açarsınız. Neye abone olunduğu bir ya da birkaç **abonelik ürünüdür** (`type: 'recurring'`), sizdeki referanslarıyla adlandırılır; fiyatı, para birimini ve dönemini ürün taşır. Aynı aboneliğe konan ürünlerin dönemi ve para birimi aynı olmalıdır. Bir kaleme `image` (`https://` adres) verirseniz ödeme sayfasında ürünün görseli yerine o gösterilir.

```ts
const subscription = await client.subscriptionPayment({
    channelReference: 'UYELIK-4471',
    items: [
        { channelReference: 'PREMIUM-AYLIK' },
        { channelReference: 'EK-KULLANICI', quantity: 3 },
    ],
    successUrl: 'https://magazam.com/tesekkurler',
    customer,
});

subscription.token; // aboneliği sonra sorgulamak ve iptal etmek için saklayın

res.redirect(subscription.checkoutUrl!);
```

Bir kaleme `unitAmount` verirseniz o fiyat **yalnızca ilk dönem** için geçerlidir (ör. ilk ay yarı fiyat); sonraki dönemler ürünün kendi fiyatından çekilir.

İlk ödeme her zaman geçidin kendi sayfasında yapılır ve kart zorunlu olarak saklanır: sonraki dönemler o karttan çekilir. Ödeme tamamlanınca müşteri `successUrl` adresinize döner ve sonucu yine `retrievePayment()` ile sorarsınız; abonelik `active` olur ve aşağıdaki bildirim de gider.

Dönem bitince yeni dönem açılır ve müşterinin varsayılan kartından çekilir. Banka kabul etmezse çekim bir buçuk gün içinde beş kez denenir (araları 3, 6, 9 ve 12 saat); bu sırada abonelik `active` kalır. Beşinci deneme de olmazsa abonelik `past_due` olur; çalışma alanı yöneticilerinize e-posta, `webhookUrl` adresinize bildirim gider. İkisi de o dönemin dilediği kartla ödenebileceği bağlantıyı taşır; bağlantıyı müşterinize siz iletirsiniz. Süre sınırı yoktur; müşteri ödediği anda abonelik kaldığı yerden devam eder.

Aboneliğin durumunu sorabilirsiniz:

```ts
const subscription = await client.retrieveSubscription({ subscriptionToken: token });

subscription.status;      // pending | active | past_due | cancelled
subscription.amount;      // 149.90 — içinde bulunulan dönemin fiyatı
subscription.endsAt;      // sonraki tahsilat zamanı
subscription.checkoutUrl; // ödenmemiş dönem varsa müşteriye verilecek adres

for (const item of subscription.items) {
    console.log(`${item.quantity} x ${item.name} (${item.channelReference})`);
}

if (subscription.isPastDue()) {
    // müşteriyi kendi ödeme sayfanızda uyarabilirsiniz
}
```

Tutar, aboneliğin **içinde bulunduğu dönemin** fiyatıdır. Ürünün fiyatını yükseltirseniz yürüyen dönem çekildiği fiyatta kalır, yeni fiyat sonraki dönemden itibaren işler.

İptalde ödenmiş günler yanmaz:

```ts
const subscription = await client.cancelSubscription({ subscriptionToken: token });

subscription.cancelledAt;   // iptal edildiği an
subscription.endsAt;        // hizmetin süreceği son gün
subscription.isCancelled(); // ödenmiş dönem sürüyorsa henüz false
```

Müşteri, ödediği dönemin sonuna kadar hizmeti almaya devam eder; o güne kadar abonelik `active` görünür, dönem bitince `cancelled` olur ve bir daha tahsilat yapılmaz. Ödenmemiş bir aboneliğin (ilk ödemesi yapılmamış ya da `past_due`) iptali hemen geçerlidir. İade yapılmaz.

Aboneliğin açılabilmesi için varsayılan ödeme hesabınızın kart saklayabiliyor olması gerekir; saklamayan bir hesapla açmaya çalışırsanız istek `subscription.payment_provider_token` alanında reddedilir.

### Abonelik bildirimleri (webhook)

Abonelik açarken `webhookUrl` verirseniz, aboneliğin durumu her değiştiğinde o adrese imzalı bir POST gönderilir. Gövde düz JSON'dur ve imza `X-Signature` başlığındadır — yani geçidin API yanıtlarıyla aynı yöntem.

```ts
const subscription = await client.subscriptionPayment({
    channelReference: 'UYELIK-4471',
    items: [{ channelReference: 'PREMIUM-AYLIK' }],
    successUrl: 'https://magazam.com/tesekkurler',
    customer,
    webhookUrl: 'https://magazam.com/odemehub/abonelik',
});
```

Bildirimi karşılayan uçta gövdeyi **ham** okuyup imzayla birlikte SDK'ya verin. İmza gövdenin bayt bayt kendisini kapsar; `express.json()` gibi gövdeyi ayrıştırıp yeniden yazan bir ara katman imzayı bozar.

```ts
import express from 'express';
import { SignatureError } from '@odemehub/node-sdk';

app.post('/odemehub/abonelik', express.raw({ type: 'application/json' }), (req, res) => {
    let webhook;

    try {
        webhook = client.subscriptionWebhook(req.body, req.get('X-Signature'));
    } catch (error) {
        if (error instanceof SignatureError) {
            return res.sendStatus(400);
        }

        throw error;
    }

    const subscription = webhook.subscription;   // sorgudakiyle aynı nesne

    if (webhook.isActive()) aboneligiAc(subscription.channelReference, subscription.endsAt);
    if (webhook.isPastDue()) musteriyiUyar(subscription.checkoutUrl);
    if (webhook.isCancelled()) yenilemeyiDurdur(subscription.endsAt);
    if (webhook.isEnded()) erisimiKapat(subscription.channelReference);

    res.sendStatus(200);
});
```

Gönderilen olaylar aboneliğin **durumudur**, yapılan işlem değil:

| Olay | Ne zaman gider |
| --- | --- |
| `active` | bir dönem ödendi (ilk ödeme ya da yenileme) |
| `past_due` | dönem kayıtlı karttan tahsil edilemedi, müşteriden bekleniyor |
| `cancelled` | abonelik iptal edildi; müşteri `endsAt` tarihine kadar hizmeti almaya devam eder |
| `ended` | ödenmiş dönem doldu, abonelik kapandı |

2xx dışında bir yanıt (ya da yanıtsızlık) başarısız sayılır; bildirim 5 dakika sonra bir kez daha denenir. Ulaşmayan bildirimler panelde aboneliğin sayfasında HTTP kodu ve yanıtıyla listelenir.

## Ödeme hangi hesaptan geçer

`paymentProviderToken` verirseniz ödeme o hesaptan geçer; sipariş ve abonelik açarken de aynı alan vardır ve müşteri ödeme sayfasında o hesaptan öder. Vermezseniz hesabı çalışma alanınız seçer: panelde **Ödeme Ayarları → Gate (Yönlendirme)** altındaki kurallar sırayla denenir ve ödemenin karşıladığı ilk kural hesabı belirler. Kurallar kartın bankasına, şemasına, programına, tipine, ticari kart olup olmadığına, tutara ve para birimine bakabilir. Hiçbir kural tutmazsa ödeme varsayılan hesaptan geçer.

- Kuralın hesabı ödemeyi alamıyorsa (ödeme türünü ya da para birimini desteklemiyorsa) o kural atlanır.
- Kayıtlı kartla ödeme her zaman kartın saklandığı hesaptan geçer.
- Taksitleri `retrieveBin()` ile gösteriyorsanız orada da hesap vermeyin: taksitler ödemenin gideceği hesaptan gelir ve çekilen tutar gösterdiğinizle aynı olur.

## Kur çevirisi

Panelde **Ödeme Ayarları → Kur Çevirici** altında bir kural tanımladıysanız, o para biriminde gelen ödeme karttan kuralın para biriminde çekilir. Örneğin 100 USD istersiniz, karttan 4.985,56 TRY çekilir. Kur, TCMB'nin güncel döviz satış kuru ve üzerine eklediğiniz marjdır ya da sizin girdiğiniz sabit kurdur.

İsteğinizde hiçbir şey değişmez: tutarı ve para birimini her zamanki gibi gönderirsiniz. Yanıttaki `conversion` karttan ne çekildiğini söyler:

```ts
const payment = await client.regularPayment({
    amount: '100.00',
    currency: 'USD',
    // ...
});

if (payment.conversion !== null) {
    payment.conversion.amount;   // 4985.56
    payment.conversion.currency; // TRY
    payment.conversion.rate;     // 49.855560
}
```

- Çevrilmeyen ödemede `conversion` `null` gelir. `retrievePayment()` aynı bilgiyi yeniden verir.
- İade tutarını çekilen para biriminde gönderin (yukarıdaki örnekte TRY).
- Güncel kur alınamıyorsa ödeme alınmaz; `422` ile `transaction.currency` alanında hata döner. Birkaç dakika sonra tekrar deneyin.

## Kart sorgusu ve taksitler

Kart numarasının ilk hanelerinden kartın kim tarafından verildiğini, hangi programa ait olduğunu ve tutarın kaç taksite bölünebileceğini sorar. Hiçbir şey çekilmez.

```ts
const bin = await client.retrieveBin({ bin: '54003600', amount: '450.00' });

if (bin.result.successful) {
    bin.issuerName;     // Garanti Bankası
    bin.program;        // Bonus
    bin.scheme;         // mastercard
    bin.type;           // credit
    bin.isCommercial;

    for (const installment of bin.installments) {
        // 3 taksitte ayda 157.87, toplam 473.60
        console.log(`${installment.number} x ${installment.amount} = ${installment.total}`);
    }
}
```

Kartın tamamını göndermeyin; ilk 6-8 hane yeter ve yalnızca o kadarı kabul edilir.

Sorgu başarısız dönebilir: kart tanınmıyor olabilir ya da hesabınızın sağlayıcısı taksit vermiyor olabilir. İki durumda da satışı durdurmayın, tek çekimle devam edin.

## Tutarlar ve taksit

İki tutar vardır ve karıştırılmamalıdır:

| Alan | Anlamı |
| --- | --- |
| `amount` | **Karttan çekilecek** tutar. Vade farkı varsa içindedir. |
| `baseAmount` | **Sattığınız** tutar, vade farkından önceki hâli. Gönderilmezse `amount` ile aynı kabul edilir. |

Taksit yalnızca Türk Lirası ödemelerde yapılır. USD, EUR ya da GBP ödemede `installmentNumber` `1` olmalıdır ve `retrieveBin()` taksit listesini boş döner; kur çevirisiyle TRY'den başka bir para birimine çekilen ödeme için de aynısı geçerlidir.

Taksitsiz satışta ikisi eşittir ve `baseAmount` göndermenize gerek yoktur. Taksitli satışta `retrieveBin` size o taksidin toplamını verir; onu `amount` olarak, sattığınız tutarı `baseAmount` olarak gönderin:

```ts
const payment = await client.regularPayment({
    channelReference: 'SIP-10234',
    amount: '473.60',        // 3 taksitin toplamı
    baseAmount: '450.00',    // satılan tutar
    installmentNumber: 3,
    // ...
});
```

Bazı sağlayıcılar vade farkını kendileri ekler; geçit bunu bilir ve gerekirse sağlayıcıya taban tutarı gönderir. Sizin tarafınızda değişen bir şey yoktur.

## Kayıtlı kartlar

Müşterinin kartını saklayıp sonraki ödemelerde numara sormadan çekim yapabilirsiniz.

```ts
// Ödeme sırasında saklamak için: karta shouldSave: true verin.
// Ödeme olmadan saklamak için:
const kept = await client.saveCard({ customer, card });

const musteri = { channelReference: 'musteri-88' };

// Müşterinin kartları
const cards = await client.savedCards({ customer: musteri });

// Varsayılan yapma / silme
const token = cards.savedCards[0].token;

await client.defaultSavedCard({ customer: musteri, savedCardToken: token });
await client.deleteSavedCard({ customer: musteri, savedCardToken: token });
```

Kayıtlı kartla ödeme alırken `card` yerine kartın token'ını verin:

```ts
const payment = await client.regularPayment({
    channelReference: 'SIP-10235',
    amount: '120.00',
    installmentNumber: 1,
    ip: req.ip,
    customer,
    savedCardToken: token,
});
```

`card` ile `savedCardToken` birlikte ya da hiçbiri verilmezse istek gönderilmeden `TypeError` ile reddedilir.

Kart saklayan bir ödemenin yanıtında `payment.savedCard` dolu gelir; kartın token'ını oradan öğrenirsiniz. Kart her yerde token ile adlandırılır.

## İade ve iptal

```ts
// Gün sonu almamış ödemenin tamamını geri alır
await client.cancelPayment({ transactionToken: payment.transactionToken });

// Tutar verilirse kısmi, verilmezse kalanın tamamı iade edilir.
// Kur çevirisiyle çekilen ödemede tutar çekilen para birimindedir.
await client.refundPayment({ transactionToken: payment.transactionToken, amount: '100.00' });
```

## Hatalar

Bütün hatalar `OdemehubError`'dan türer; tek bir `instanceof` kontrolü hepsini yakalar.

| Hata | Ne demek |
| --- | --- |
| `ValidationError` | Gönderdiğiniz alanlar kabul edilmedi. Ödeme denenmedi. `error.errors` alan alan söyler. |
| `AuthenticationError` | API anahtarı bu takıma ait değil ya da imza gizli anahtarla tutmuyor. |
| `SignatureError` | Gelen yanıtın ya da bildirimin imzası tutmadı. Geçitten geldiği kanıtlanamaz; **işleme almayın**. |
| `TransportError` | Geçide ulaşılamadı ya da yanıt okunamadı. Ödemenin ne olduğu belirsizdir; geçitteki kayıt asıl doğruyu söyler. |
| `UnexpectedResponseError` | Beklenmeyen bir yanıt geldi. `error.status` HTTP kodunu verir. |

```ts
import { OdemehubError, ValidationError } from '@odemehub/node-sdk';

try {
    await client.regularPayment(payment);
} catch (error) {
    if (error instanceof ValidationError) {
        console.log(error.errors); // { 'transaction.amount': ['...'] }
    } else if (error instanceof OdemehubError) {
        console.log(error.message);
    } else {
        throw error;
    }
}
```

Ağ hatasında ödemeyi körlemesine tekrarlamayın: `TransportError` "olmadı" demek değil, "bilmiyorum" demektir.

## İmzayı elle doğrulamak

İmza, gövdenin tam metninin gizli anahtarla HMAC-SHA256'sıdır, küçük harf hex olarak yazılır. SDK bunu `Signature` sınıfıyla yapar; aynı hesabı kendiniz de yapabilirsiniz:

```ts
import { createHmac } from 'node:crypto';

createHmac('sha256', apiSecret).update(body).digest('hex');
```

Test vektörü: `secret_test` anahtarıyla `{"a":1}` gövdesinin imzası `6d0c951564cdd2b6b70e75b214293a8cd2542815ba54fe91c7f6ce105bc3d592`'dir.
