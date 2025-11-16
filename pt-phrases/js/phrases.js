// Brazilian Portuguese Phrases for Budget Travelers
// Format: { pt: "Portuguese", ipa: "IPA pronunciation", en: "English meaning", category: "category" }

const PHRASES = [
    // Basics
    {
        pt: "Bom dia",
        ipa: "bõ ˈdʒi.ɐ",
        en: "Good morning",
        category: "basics"
    },
    {
        pt: "Boa tarde",
        ipa: "ˈbo.ɐ ˈtaʁ.dʒi",
        en: "Good afternoon",
        category: "basics"
    },
    {
        pt: "Boa noite",
        ipa: "ˈbo.ɐ ˈnoj.tʃi",
        en: "Good evening/night",
        category: "basics"
    },
    {
        pt: "Por favor",
        ipa: "puʁ fɐˈvoʁ",
        en: "Please",
        category: "basics"
    },
    {
        pt: "Obrigado / Obrigada",
        ipa: "o.bɾiˈɡa.du / o.bɾiˈɡa.dɐ",
        en: "Thank you (m/f)",
        category: "basics"
    },
    {
        pt: "De nada",
        ipa: "dʒi ˈna.dɐ",
        en: "You're welcome",
        category: "basics"
    },
    {
        pt: "Desculpa",
        ipa: "dʒisˈkuw.pɐ",
        en: "Sorry / Excuse me",
        category: "basics"
    },
    {
        pt: "Fala inglês?",
        ipa: "ˈfa.lɐ ĩˈɡles",
        en: "Do you speak English?",
        category: "basics"
    },
    {
        pt: "Eu não entendo",
        ipa: "ew nɐ̃w ẽˈtẽ.du",
        en: "I don't understand",
        category: "basics"
    },
    {
        pt: "Pode repetir?",
        ipa: "ˈpɔ.dʒi ʁe.peˈtʃiʁ",
        en: "Can you repeat?",
        category: "basics"
    },

    // Navigation & Directions
    {
        pt: "Onde fica...?",
        ipa: "ˈõ.dʒi ˈfi.kɐ",
        en: "Where is...?",
        category: "navigation"
    },
    {
        pt: "Como chego em...?",
        ipa: "ˈko.mu ˈʃe.ɡu ẽj",
        en: "How do I get to...?",
        category: "navigation"
    },
    {
        pt: "Fica longe?",
        ipa: "ˈfi.kɐ ˈlõ.ʒi",
        en: "Is it far?",
        category: "navigation"
    },
    {
        pt: "Fica perto?",
        ipa: "ˈfi.kɐ ˈpɛʁ.tu",
        en: "Is it close/nearby?",
        category: "navigation"
    },
    {
        pt: "À esquerda",
        ipa: "a isˈkɛʁ.dɐ",
        en: "To the left",
        category: "navigation"
    },
    {
        pt: "À direita",
        ipa: "a dʒiˈɾej.tɐ",
        en: "To the right",
        category: "navigation"
    },
    {
        pt: "Reto / Direto",
        ipa: "ˈʁe.tu / dʒiˈɾe.tu",
        en: "Straight ahead",
        category: "navigation"
    },
    {
        pt: "Aqui",
        ipa: "ɐˈki",
        en: "Here",
        category: "navigation"
    },
    {
        pt: "Ali / Lá",
        ipa: "ɐˈli / ˈla",
        en: "There",
        category: "navigation"
    },
    {
        pt: "Onde é o banheiro?",
        ipa: "ˈõ.dʒi ɛ u bɐˈɲej.ɾu",
        en: "Where is the bathroom?",
        category: "navigation"
    },

    // Prices & Money
    {
        pt: "Quanto custa?",
        ipa: "ˈkwɐ̃.tu ˈkus.tɐ",
        en: "How much does it cost?",
        category: "prices"
    },
    {
        pt: "Quanto é?",
        ipa: "ˈkwɐ̃.tu ɛ",
        en: "How much is it?",
        category: "prices"
    },
    {
        pt: "Muito caro",
        ipa: "ˈmũj.tu ˈka.ɾu",
        en: "Too expensive",
        category: "prices"
    },
    {
        pt: "Tem mais barato?",
        ipa: "tẽj majs bɐˈɾa.tu",
        en: "Do you have cheaper?",
        category: "prices"
    },
    {
        pt: "Aceita cartão?",
        ipa: "ɐˈsej.tɐ kaʁˈtɐ̃w",
        en: "Do you accept card?",
        category: "prices"
    },
    {
        pt: "Só dinheiro",
        ipa: "sɔ dʒĩˈɲej.ɾu",
        en: "Cash only",
        category: "prices"
    },
    {
        pt: "Tem troco?",
        ipa: "tẽj ˈtɾɔ.ku",
        en: "Do you have change?",
        category: "prices"
    },
    {
        pt: "Pode fazer desconto?",
        ipa: "ˈpɔ.dʒi fɐˈzeʁ desˈkõ.tu",
        en: "Can you give a discount?",
        category: "prices"
    },

    // Boats & River Travel
    {
        pt: "Onde pega o barco?",
        ipa: "ˈõ.dʒi ˈpe.ɡɐ u ˈbaʁ.ku",
        en: "Where do I catch the boat?",
        category: "boats"
    },
    {
        pt: "Que horas sai o barco?",
        ipa: "ki ˈɔ.ɾɐs saj u ˈbaʁ.ku",
        en: "What time does the boat leave?",
        category: "boats"
    },
    {
        pt: "Vai para...?",
        ipa: "vaj ˈpa.ɾɐ",
        en: "Does it go to...?",
        category: "boats"
    },
    {
        pt: "Quanto tempo demora?",
        ipa: "ˈkwɐ̃.tu ˈtẽ.pu deˈmɔ.ɾɐ",
        en: "How long does it take?",
        category: "boats"
    },
    {
        pt: "Tem lugar na rede?",
        ipa: "tẽj luˈɡaʁ nɐ ˈʁe.dʒi",
        en: "Is there space for a hammock?",
        category: "boats"
    },
    {
        pt: "Lancha ou barco?",
        ipa: "ˈlɐ̃.ʃɐ o ˈbaʁ.ku",
        en: "Fast boat or slow boat?",
        category: "boats"
    },
    {
        pt: "Para aqui",
        ipa: "ˈpa.ɾɐ ɐˈki",
        en: "Stop here",
        category: "boats"
    },
    {
        pt: "Porto / Cais",
        ipa: "ˈpoʁ.tu / kajs",
        en: "Port / Dock",
        category: "boats"
    },

    // Food & Markets
    {
        pt: "Tem comida?",
        ipa: "tẽj koˈmĩ.dɐ",
        en: "Do you have food?",
        category: "food"
    },
    {
        pt: "Quero água",
        ipa: "ˈkɛ.ɾu ˈa.ɡwɐ",
        en: "I want water",
        category: "food"
    },
    {
        pt: "Um café, por favor",
        ipa: "ũ kɐˈfɛ puʁ fɐˈvoʁ",
        en: "A coffee, please",
        category: "food"
    },
    {
        pt: "Tem fruta?",
        ipa: "tẽj ˈfɾu.tɐ",
        en: "Do you have fruit?",
        category: "food"
    },
    {
        pt: "O que é isso?",
        ipa: "u ki ɛ ˈi.su",
        en: "What is this?",
        category: "food"
    },
    {
        pt: "É gostoso?",
        ipa: "ɛ ɡosˈto.zu",
        en: "Is it tasty/good?",
        category: "food"
    },
    {
        pt: "Não come carne",
        ipa: "nɐ̃w ˈkɔ.mi ˈkaʁ.ni",
        en: "Doesn't eat meat (vegetarian)",
        category: "food"
    },
    {
        pt: "Suco natural",
        ipa: "ˈsu.ku nɐ.tuˈɾaw",
        en: "Fresh juice",
        category: "food"
    },
    {
        pt: "Marmita",
        ipa: "maʁˈmi.tɐ",
        en: "Lunch box / cheap meal",
        category: "food"
    },
    {
        pt: "Tem pão?",
        ipa: "tẽj pɐ̃w",
        en: "Do you have bread?",
        category: "food"
    },

    // Time & Schedules
    {
        pt: "Que horas são?",
        ipa: "ki ˈɔ.ɾɐs sɐ̃w",
        en: "What time is it?",
        category: "time"
    },
    {
        pt: "Abre que horas?",
        ipa: "ˈa.bɾi ki ˈɔ.ɾɐs",
        en: "What time does it open?",
        category: "time"
    },
    {
        pt: "Fecha que horas?",
        ipa: "ˈfe.ʃɐ ki ˈɔ.ɾɐs",
        en: "What time does it close?",
        category: "time"
    },
    {
        pt: "Amanhã",
        ipa: "ɐ.mɐˈɲɐ̃",
        en: "Tomorrow",
        category: "time"
    },
    {
        pt: "Hoje",
        ipa: "ˈo.ʒi",
        en: "Today",
        category: "time"
    },
    {
        pt: "Agora",
        ipa: "ɐˈɡɔ.ɾɐ",
        en: "Now",
        category: "time"
    },
    {
        pt: "Depois",
        ipa: "deˈpojs",
        en: "Later / After",
        category: "time"
    },
    {
        pt: "Quanto tempo?",
        ipa: "ˈkwɐ̃.tu ˈtẽ.pu",
        en: "How long? / How much time?",
        category: "time"
    },
    {
        pt: "Já volta",
        ipa: "ˈʒa ˈvɔw.tɐ",
        en: "Be right back / Coming back soon",
        category: "time"
    },

    // Essential Numbers
    {
        pt: "Um / Uma",
        ipa: "ũ / ˈũ.mɐ",
        en: "One (m/f)",
        category: "basics"
    },
    {
        pt: "Dois / Duas",
        ipa: "dojs / ˈdu.ɐs",
        en: "Two (m/f)",
        category: "basics"
    },
    {
        pt: "Três",
        ipa: "tɾes",
        en: "Three",
        category: "basics"
    },
    {
        pt: "Quatro",
        ipa: "ˈkwa.tɾu",
        en: "Four",
        category: "basics"
    },
    {
        pt: "Cinco",
        ipa: "ˈsĩ.ku",
        en: "Five",
        category: "basics"
    },
    {
        pt: "Dez",
        ipa: "dɛs",
        en: "Ten",
        category: "basics"
    },
    {
        pt: "Vinte",
        ipa: "ˈvĩ.tʃi",
        en: "Twenty",
        category: "basics"
    },
    {
        pt: "Cem",
        ipa: "sẽj",
        en: "One hundred",
        category: "basics"
    }
];
