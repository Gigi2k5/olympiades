import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import api from '../../services/api'

// Contenu statique par défaut pour les pages légales
const DEFAULT_PAGES = {
  'mentions-legales': {
    title: 'Mentions Légales',
    content: `
      <h2>Éditeur du site</h2>
      <p>Le site <strong>Olympiades IA Bénin</strong> est édité par le Comité National des Olympiades d'Intelligence Artificielle du Bénin.</p>
      <p><strong>Adresse :</strong> Cotonou, Bénin</p>
      <p><strong>Email :</strong> contact@olympiades-ia.bj</p>
      
      <h2>Hébergement</h2>
      <p>Ce site est hébergé par des services cloud sécurisés.</p>
      
      <h2>Propriété intellectuelle</h2>
      <p>L'ensemble des contenus présents sur ce site (textes, images, logos, etc.) sont protégés par le droit d'auteur. Toute reproduction, même partielle, est interdite sans autorisation préalable.</p>
      
      <h2>Responsabilité</h2>
      <p>Le Comité National des Olympiades IA s'efforce d'assurer l'exactitude des informations publiées sur ce site. Toutefois, il ne saurait être tenu responsable des erreurs, omissions ou des résultats qui pourraient être obtenus par un mauvais usage de ces informations.</p>
      
      <h2>Liens externes</h2>
      <p>Ce site peut contenir des liens vers d'autres sites. Le Comité National des Olympiades IA n'est pas responsable du contenu de ces sites externes.</p>
    `
  },
  'cgu': {
    title: "Conditions Générales d'Utilisation",
    content: `
      <h2>1. Objet</h2>
      <p>Les présentes Conditions Générales d'Utilisation (CGU) ont pour objet de définir les modalités d'accès et d'utilisation du site des Olympiades IA Bénin.</p>
      
      <h2>2. Acceptation des CGU</h2>
      <p>L'utilisation du site implique l'acceptation pleine et entière des présentes CGU. Si vous n'acceptez pas ces conditions, veuillez ne pas utiliser ce site.</p>
      
      <h2>3. Inscription</h2>
      <p>Pour participer aux Olympiades IA, vous devez créer un compte en fournissant des informations exactes et complètes. Vous êtes responsable de la confidentialité de vos identifiants de connexion.</p>
      
      <h2>4. Conditions de participation</h2>
      <p>Les Olympiades IA Bénin sont ouvertes aux élèves du secondaire résidant au Bénin. Les participants doivent être âgés de 14 à 19 ans au moment de l'inscription.</p>
      
      <h2>5. Comportement</h2>
      <p>Les utilisateurs s'engagent à :</p>
      <ul>
        <li>Fournir des informations véridiques</li>
        <li>Ne pas tricher lors des épreuves</li>
        <li>Respecter les autres participants</li>
        <li>Ne pas tenter de compromettre la sécurité du site</li>
      </ul>
      
      <h2>6. Propriété intellectuelle</h2>
      <p>Tous les contenus du site sont protégés par le droit d'auteur. Les questions du QCM et les supports de formation restent la propriété exclusive du Comité.</p>
      
      <h2>7. Sanctions</h2>
      <p>En cas de non-respect des présentes CGU, le Comité se réserve le droit de suspendre ou supprimer le compte de l'utilisateur, et d'annuler sa participation aux Olympiades.</p>
      
      <h2>8. Modification des CGU</h2>
      <p>Le Comité se réserve le droit de modifier les présentes CGU à tout moment. Les utilisateurs seront informés de toute modification.</p>
    `
  },
  'confidentialite': {
    title: 'Politique de Confidentialité',
    content: `
      <h2>1. Collecte des données</h2>
      <p>Dans le cadre de votre inscription aux Olympiades IA Bénin, nous collectons les données suivantes :</p>
      <ul>
        <li>Nom et prénom</li>
        <li>Date de naissance</li>
        <li>Adresse email</li>
        <li>Numéro de téléphone</li>
        <li>Établissement scolaire</li>
        <li>Photo d'identité</li>
        <li>Bulletins scolaires</li>
      </ul>
      
      <h2>2. Utilisation des données</h2>
      <p>Vos données personnelles sont utilisées pour :</p>
      <ul>
        <li>Gérer votre inscription et participation</li>
        <li>Vous contacter concernant les Olympiades</li>
        <li>Établir le classement</li>
        <li>Produire des statistiques anonymisées</li>
      </ul>
      
      <h2>3. Conservation des données</h2>
      <p>Vos données sont conservées pendant la durée de votre participation et jusqu'à 3 ans après la fin de l'édition concernée, sauf obligation légale contraire.</p>
      
      <h2>4. Partage des données</h2>
      <p>Vos données ne sont jamais vendues à des tiers. Elles peuvent être partagées avec :</p>
      <ul>
        <li>Les membres du Comité d'organisation</li>
        <li>L'IOAI (International Olympiad in Artificial Intelligence) pour les candidats sélectionnés</li>
        <li>Les autorités compétentes si la loi l'exige</li>
      </ul>
      
      <h2>5. Sécurité</h2>
      <p>Nous mettons en œuvre des mesures techniques et organisationnelles appropriées pour protéger vos données contre tout accès non autorisé, modification, divulgation ou destruction.</p>
      
      <h2>6. Vos droits</h2>
      <p>Conformément à la réglementation en vigueur, vous disposez des droits suivants :</p>
      <ul>
        <li>Droit d'accès à vos données</li>
        <li>Droit de rectification</li>
        <li>Droit à l'effacement</li>
        <li>Droit à la limitation du traitement</li>
        <li>Droit à la portabilité</li>
      </ul>
      <p>Pour exercer ces droits, contactez-nous à : <strong>contact@olympiades-ia.bj</strong></p>
      
      <h2>7. Cookies</h2>
      <p>Ce site utilise des cookies techniques nécessaires à son fonctionnement. Aucun cookie publicitaire n'est utilisé.</p>
    `
  }
}

export default function StaticPage({ slug }) {
  const [page, setPage] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchPage = async () => {
      try {
        setLoading(true)
        const response = await api.get(`/pages/${slug}`)
        if (response.data.success && response.data.data) {
          setPage(response.data.data)
        } else {
          // Utiliser le contenu par défaut
          setPage(DEFAULT_PAGES[slug] || null)
        }
      } catch (err) {
        console.log('Page API not available, using default content')
        // Utiliser le contenu par défaut
        setPage(DEFAULT_PAGES[slug] || null)
      } finally {
        setLoading(false)
      }
    }

    fetchPage()
  }, [slug])

  // Loading skeleton
  if (loading) {
    return (
      <div className="min-h-screen bg-white py-24 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="h-10 bg-slate-200 rounded-lg w-2/3 mb-8 animate-pulse" />
          <div className="space-y-4">
            <div className="h-4 bg-slate-100 rounded w-full animate-pulse" />
            <div className="h-4 bg-slate-100 rounded w-5/6 animate-pulse" />
            <div className="h-4 bg-slate-100 rounded w-4/5 animate-pulse" />
          </div>
        </div>
      </div>
    )
  }

  // Si pas de contenu même par défaut
  if (!page) {
    return (
      <div className="min-h-screen bg-white py-24 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="font-display text-2xl font-bold text-slate-900 mb-4">
            Page non disponible
          </h1>
          <p className="text-slate-500 mb-8">
            Cette page n'est pas encore disponible.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#206080] text-white font-medium rounded-xl hover:bg-[#185068] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour à l'accueil
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white py-24 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-4xl mx-auto"
      >
        {/* Titre */}
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 mb-8">
          {page.title}
        </h1>

        {/* Contenu */}
        <div
          className="prose prose-slate max-w-none
            prose-headings:font-display prose-headings:text-slate-900
            prose-h2:text-2xl prose-h2:mt-8 prose-h2:mb-4
            prose-h3:text-xl prose-h3:mt-6 prose-h3:mb-3
            prose-p:text-slate-600 prose-p:leading-relaxed
            prose-a:text-[#206080] prose-a:no-underline hover:prose-a:underline
            prose-strong:text-slate-900
            prose-ul:text-slate-600 prose-ol:text-slate-600
            prose-li:marker:text-slate-400"
          dangerouslySetInnerHTML={{ __html: page.content }}
        />

        {/* Date de mise à jour */}
        {page.updated_at && (
          <p className="mt-12 pt-6 border-t border-slate-200 text-sm text-slate-400">
            Dernière mise à jour : {new Date(page.updated_at).toLocaleDateString('fr-FR', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </p>
        )}

        {/* Lien retour */}
        <div className="mt-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-[#206080] hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour à l'accueil
          </Link>
        </div>
      </motion.div>
    </div>
  )
}