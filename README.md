+ add life group URL parameter (optional)
+ when no life group given: start overview page
  + load image of most common taxon for each group
  + display all these images with "bird/insect/…" overlay
  + when user taps on one of the images, load all photos for this life group
  + think about how to allow for caching this on github.io:
    + as we can't do server-side, let's add a script that writes a file with the links to the respective photos for each location, maybe as JSON? save these location files in a dedicated folder. name each file with the location id

+ check + fix console log
+ tapping on location does same as location pin icon
+ make sure dark mode looks nice
+ add "other" to species picker, which allows user to enter a taxon (eg. "monkey")
+ add "here" to "choose location"
  + needs location permission

## Future Functions
+ show most common animals/plants/…
  + search by name?
  + add hierarchical tree?
