+ add life group URL parameter (optional)
+ when no life group given: start overview page
  + load image of most common taxon for each group
  + display all these images with "bird/insect/…" overlay
  + when user taps on one of the images, load all photos for this life group
  + think about how to allow for caching this on github.io:
    + as we can't do server-side, let's add a script that writes a file with the links to the respective photos for each location, maybe as JSON? save these location files in a dedicated folder. name each file with the location id

+ italics for taxon (if vernacular not available)
+ taxon dialog:
  + lose "observations" + "taxonomic rank"
  + add "scientific name" before taxonName
+ sometimes gets stuck on "cargando ubicación"
+ flickering on reload after new location
+ make sure dark mode looks nice
  + dark background in dark mode only for first scrolling page :p
  + location search display looks bad
+ improve location search
  + add location picker
  + add region fallback if no taxa found for location (eg. because too small)
  + add "other" to species picker, which allows user to enter a taxon (eg. "monkey")
  + add "here" to "choose location"
    + needs location permission

## Future Functions
+ show most common animals/plants/…
  + search by name?
  + add hierarchical tree?
