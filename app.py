import numpy as np # This module is used for numerical operations
import pandas as pd # This module is used for data manipulation and analysis
from sklearn.preprocessing import StandardScaler # This module is used for feature scaling
from sklearn.model_selection import train_test_split # This module is used for splitting the dataset into training and testing sets
from sklearn import svm # This module is used for Support Vector Machine (SVM) classification
from sklearn.metrics import accuracy_score # This module is used for evaluating the accuracy of the model

#loading the dibetes dataset to a pandas dataframe
diabetes_dataset = pd.read_csv('C:\\Users\\thesh\\OneDrive\\Desktop\\Dibetic-detection\\diabetes.csv')

#printing the first 5 rows of the dataset
print(diabetes_dataset.head()) # Print the first 5 rows of the dataset
# number of rows and columns in this dataset
print(diabetes_dataset.shape) # Print the number of rows and columns

#getting the statistical measures of the data
print(diabetes_dataset.describe()) # Print the statistical measures of the data

diabetes_dataset['Outcome'].value_counts() # Print the count of each class in the 'Outcome' column
# print(diabetes_dataset['Outcome'].value_counts()) # Print the count of each class in the 'Outcome' column

# 0--> Non-Diabetic 1--> Diabetic
diabetes_dataset.groupby('Outcome').mean()  # Print the mean of each feature grouped by the 'Outcome' column
# print(diabetes_dataset.groupby('Outcome').mean())  # Print the mean of each feature grouped by the 'Outcome' column

#sepreting the data and labels
X = diabetes_dataset.drop(columns='Outcome') # Features (all columns except 'Outcome')
Y = diabetes_dataset['Outcome'] # Labels (the 'Outcome' column)

print(X) # Print the features
print(Y) # Print the labels

# data standardization, now using the StandardScaler module from sklearn.preprocessing to standardize the features. This will ensure that each feature has a mean of 0 and a standard deviation of 1, which can improve the performance of many machine learning algorithms.
scaler = StandardScaler() # Create an instance of the StandardScaler
scaler.fit(X) # Fit the scaler to the features
standardized_data = scaler.transform(X) # Transform the features using the fitted scaler
print(standardized_data) # Print the standardized features

X = standardized_data # Update the features to be the standardized data
Y = diabetes_dataset['Outcome'] # Labels (the 'Outcome' column)

print(X) # Print the standardized features
print(Y) # Print the labels

# train test split
X_train, X_test, Y_train, Y_test = train_test_split(X, Y, test_size=0.2, stratify=Y, random_state=2) # Split the dataset into training and testing sets
print(X.shape, X_train.shape, X_test.shape) # Print the shapes of the features and the training/testing sets

#training the model
classifier = svm.SVC(kernel = 'linear') # Create an instance of the SVM classifier with a linear kernel
#Training the SVM classifier using the training data
classifier.fit(X_train, Y_train) # Fit the classifier to the training data
#model evaluation
#accuracy score on training data
X_train_accuracy = classifier.predict(X_train) # Predict the labels for the training data
training_data_accuracy = accuracy_score(Y_train, X_train_accuracy) # Calculate the accuracy score for the training data
print("Training Data Accuracy:", training_data_accuracy)

#accuracy score on test data
X_test_accuracy = classifier.predict(X_test) # Predict the labels for the test data
test_data_accuracy = accuracy_score(Y_test, X_test_accuracy) # Calculate the accuracy score for the test data
print("Test Data Accuracy:", test_data_accuracy)

#making a predictive system
input_data = (5,166,72,19,175,25.8,0.587,51) # Example input data for prediction
#changing the input data to a numpy array
input_data_as_numpy_array = np.asarray(input_data) # Convert the input data to a numpy array
#reshaping the numpy array as we are predicting for one instance
input_data_reshaped = input_data_as_numpy_array.reshape(1,-1) # Reshape the numpy array for prediction
#standardizing the input data
std_data = scaler.transform(input_data_reshaped) # Standerdize the input data using the fitted scaler
prediction = classifier.predict(std_data) # Make a prediction using the trained classifier
print(prediction) # Print the prediction result

if (prediction)[0] == 0: # Check if the prediction is 0 (Non-Diabetic)
    print('The person is not diabetic') # Print the result for Non-Diabetic
else: # If the prediction is not 0, it must be 1 (Diabetic)
    print('The person is diabetic') # Print the result for Diabetic